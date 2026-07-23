const mongoose = require('mongoose');
const ChatSession = require('../models/ChatSession');
const Message = require('../models/Message');
const Merchant = require('../models/Merchant');
const { sendPushNotifications } = require('../utils/pushNotifications');

const sessionViewers = {}; // sessionId -> { socketId: { agentId, name, profilePic } }
const connectedAgents = new Set();

module.exports = (io, app) => {
  if (app) app.set('connectedAgents', connectedAgents);
  // Background job to clean up inactive sessions (10 minutes inactivity timeout)
  setInterval(async () => {
    const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes
    const thresholdTime = new Date(Date.now() - INACTIVITY_TIMEOUT);
    
    try {
      // Find active sessions that have been inactive for more than 10 minutes
      const inactiveSessions = await ChatSession.find({
        status: 'active',
        $or: [
          { lastMessageAt: { $lt: thresholdTime } },
          { lastMessageAt: { $exists: false }, createdAt: { $lt: thresholdTime } }
        ]
      });
      
      for (const session of inactiveSessions) {
        await closeSessionHelper(session);
      }
    } catch (err) {
      console.error('Error in session cleanup job:', err);
    }
  }, 60 * 1000); // Check every 1 minute

  const cleanupViewing = (sk) => {
    const prevSessionId = sk.viewingSessionId;
    if (prevSessionId && sessionViewers[prevSessionId]) {
      delete sessionViewers[prevSessionId][sk.id];
      if (Object.keys(sessionViewers[prevSessionId]).length === 0) {
        delete sessionViewers[prevSessionId];
      }
      sk.leave(`session_${prevSessionId}`);
      sk.viewingSessionId = null;
      sendActiveViewersUpdate(prevSessionId);
    }
  };

  const sendActiveViewersUpdate = (sessionId) => {
    const viewersMap = sessionViewers[sessionId] || {};
    const uniqueAgents = [];
    const seenIds = new Set();
    
    Object.values(viewersMap).forEach(agent => {
      if (agent.agentId && !seenIds.has(agent.agentId.toString())) {
        seenIds.add(agent.agentId.toString());
        uniqueAgents.push(agent);
      }
    });

    io.to(`session_${sessionId}`).emit('active_viewers_updated', uniqueAgents);
  };

  const notifyMerchants = async (merchantId, sessionId, eventName, eventData) => {
    if (!merchantId) return;
    io.to(merchantId.toString()).emit(eventName, eventData);
    
    try {
      const session = await ChatSession.findById(sessionId);
      if (session && session.widgetId && mongoose.Types.ObjectId.isValid(session.widgetId)) {
        const owner = await Merchant.findById(merchantId);
        if (owner) {
          const widget = owner.widgets.id(session.widgetId);
          if (widget && widget.authorizedUsers) {
            widget.authorizedUsers.forEach(au => {
              const uid = au.user ? au.user.toString() : au.toString();
              io.to(uid).emit(eventName, eventData);
            });
          }
        }
      }
    } catch (err) {
      console.error('Error in notifyMerchants:', err);
    }
  };

  const closeSessionHelper = async (session) => {
    try {
      session.status = 'closed';
      session.lastMessage = 'This chat session has ended.';
      session.lastMessageAt = Date.now();
      await session.save();

      const systemMsg = await Message.create({
        sessionId: session._id,
        sender: 'system',
        content: 'This chat session has ended.',
        status: 'read'
      });

      await notifyMerchants(session.merchantId, session._id, 'receive_message', systemMsg);
      await notifyMerchants(session.merchantId, session._id, 'session_updated', session);

      io.to(`session_${session._id}`).emit('receive_message', systemMsg);
      io.to(`session_${session._id}`).emit('session_closed', { sessionId: session._id });
    } catch (err) {
      console.error('Error in closeSessionHelper:', err);
    }
  };

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Merchant joins their own room to listen to all their chats
    socket.on('merchant_join', async (merchantId) => {
      socket.merchantId = merchantId;
      connectedAgents.add(merchantId.toString());
      socket.join(merchantId);
      console.log(`Merchant ${merchantId} joined room`);
      try {
        const merchantUser = await Merchant.findById(merchantId);
        const ownWidgets = merchantUser ? merchantUser.widgets.map(w => w._id.toString()) : [];

        const ownersWithAccess = await Merchant.find({ 'widgets.authorizedUsers.user': merchantId });
        let accessibleWidgets = [...ownWidgets];
        
        ownersWithAccess.forEach(owner => {
          owner.widgets.forEach(w => {
            if (w.authorizedUsers.some(au => au.user.toString() === merchantId)) {
              accessibleWidgets.push(w._id.toString());
            }
          });
        });

        // Send all sessions to merchant
        const sessions = await ChatSession.find({
          $or: [
            { merchantId },
            { widgetId: { $in: accessibleWidgets } }
          ]
        }).sort({ lastMessageAt: -1 });
        socket.emit('all_sessions', sessions);
      } catch (err) {
        console.error('Error fetching sessions', err);
      }
    });

    // Merchant fetches chat history for a specific session
    socket.on('get_chat_history', async (data) => {
      try {
        // Accept both plain string and object {sessionId, ...}
        const sessionId = typeof data === 'string' ? data : (data?.sessionId || data);
        if (!sessionId || typeof sessionId !== 'string') {
          console.error('get_chat_history: invalid sessionId', data);
          return;
        }
        const messages = await Message.find({ sessionId }).sort({ timestamp: 1 });
        socket.emit('chat_history_merchant', { sessionId, messages });
      } catch (err) {
        console.error('Error fetching chat history', err);
      }
    });

    socket.on('visitor_join', async ({ merchantId, visitorId, visitorDomain, visitorPath, widgetId, companyName, visitorName: vName, visitorEmail, visitorPhone, visitorDetails }) => {
      try {
        let session = await ChatSession.findOne({ merchantId, visitorId, status: 'active' });
        
        const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes
        if (session) {
          const lastActive = session.lastMessageAt || session.createdAt;
          if (Date.now() - new Date(lastActive).getTime() > INACTIVITY_TIMEOUT) {
            await closeSessionHelper(session);
            session = null;
          }
        }

        if (!session) {
          // Check if widget is online before creating a new session
          const merchantUser = await Merchant.findOne({ "widgets._id": widgetId })
            .populate('widgets.authorizedUsers.user', 'name profilePic status schedule');
          if (merchantUser) {
            const widgetObj = merchantUser.widgets.id(widgetId);
            if (widgetObj) {
              const isOwnerConnected = connectedAgents.has(merchantUser._id.toString());
              const isAnyAgentConnected = widgetObj.authorizedUsers?.some(au => au.user && connectedAgents.has(au.user._id.toString())) || false;
              const isAgentConnected = isOwnerConnected || isAnyAgentConnected;

              let isWidgetOnline = false;
              if (isAgentConnected) {
                const widgetStatus = widgetObj.status || 'online';
                if (widgetStatus === 'online') {
                  if (widgetObj.schedule && widgetObj.schedule.enabled) {
                    const now = new Date();
                    const currentHour = now.getHours().toString().padStart(2, '0');
                    const currentMinute = now.getMinutes().toString().padStart(2, '0');
                    const currentTimeString = `${currentHour}:${currentMinute}`;
                    
                    const { start, end } = widgetObj.schedule;
                    if (start && end) {
                      if (start <= end) {
                        if (currentTimeString >= start && currentTimeString <= end) {
                          isWidgetOnline = true;
                        }
                      } else {
                        if (currentTimeString >= start || currentTimeString <= end) {
                          isWidgetOnline = true;
                        }
                      }
                    } else {
                      isWidgetOnline = true;
                    }
                  } else {
                    isWidgetOnline = true;
                  }
                }
              }

              if (!isWidgetOnline) {
                console.log(`Blocked session creation for visitor ${visitorId} because widget ${widgetId} is offline`);
                socket.emit('widget_offline_state', { offline: true });
                return;
              }
            }
          }

          // Generate a unique 4 character alphanumeric string
          const randomId = Math.random().toString(36).substring(2, 6);
          
          session = await ChatSession.create({
            merchantId,
            widgetId,
            source: companyName || 'Website',
            visitorId,
            visitorName: vName || `Guest ${randomId}`,
            visitorEmail: visitorEmail || '',
            visitorPhone: visitorPhone || '',
            visitorDetails: visitorDetails || '',
            visitorDomain: visitorDomain || 'Unknown',
            visitorPath: visitorPath || '/',
            visitorStatus: 'online'
          });
        } else {
          session.visitorStatus = 'online';
          session.isOfflineLead = false; // Reset offline lead status as they are now active
          if (visitorDomain) session.visitorDomain = visitorDomain;
          if (visitorPath) session.visitorPath = visitorPath;
          if (vName) session.visitorName = vName;
          if (visitorEmail) session.visitorEmail = visitorEmail;
          if (visitorPhone) session.visitorPhone = visitorPhone;
          if (visitorDetails) session.visitorDetails = visitorDetails;
          await session.save();
        }

        const roomName = `session_${session._id}`;
        socket.join(roomName);
        socket.sessionId = session._id;
        socket.merchantId = merchantId;
        console.log(`Visitor ${visitorId} joined room ${roomName}`);

        // Notify merchant via socket
        await notifyMerchants(merchantId, session._id, 'new_session', session);

        // Send FCM push notification — regular notification when visitor arrives (not alarm)
        try {
          const merchantOwner = await Merchant.findById(merchantId);
          if (merchantOwner) {
            const agentIds = [merchantId.toString()];
            if (widgetId && mongoose.Types.ObjectId.isValid(widgetId)) {
              const widgetObj = merchantOwner.widgets.id(widgetId);
              if (widgetObj && widgetObj.authorizedUsers) {
                widgetObj.authorizedUsers.forEach(au => {
                  const uid = au.user ? au.user.toString() : au.toString();
                  if (!agentIds.includes(uid)) agentIds.push(uid);
                });
              }
            }
            const visitorLabel = session.visitorName || 'New Visitor';
            const domainLabel = session.visitorDomain || '';
            await sendPushNotifications(
              agentIds,
              `👤 New Visitor: ${visitorLabel}`,
              domainLabel ? `Visiting from ${domainLabel}` : 'A visitor has opened the chat widget',
              {
                sessionId: session._id.toString(),
                screen: 'chat',
                soundType: 'default',
                isUnassigned: 'false',
                visitorName: session.visitorName || '',
                visitorEmail: session.visitorEmail || '',
                visitorPhone: session.visitorPhone || '',
                visitorDomain: session.visitorDomain || '',
                visitorPath: session.visitorPath || ''
              },
              { android: { priority: 'high' } }
            );
          }
        } catch (pushErr) {
          console.error('Error sending new visitor push notification:', pushErr);
        }

        // Send chat history to visitor
        const messages = await Message.find({ sessionId: session._id }).sort({ timestamp: 1 });
        socket.emit('chat_history', { sessionId: session._id, messages });
        
        // Send active viewing agents list to visitor
        sendActiveViewersUpdate(session._id);
      } catch (err) {
        console.error('Error on visitor join', err);
      }
    });

    // Handle incoming messages
    socket.on('send_message', async ({ sessionId, sender, content, merchantId, fileUrl, fileType, replyTo, senderId, senderName, senderProfilePic, tempId }) => {
      try {
        const sessionObj = await ChatSession.findById(sessionId);
        if (!sessionObj || sessionObj.status === 'closed') {
          console.log(`Blocked message sending to closed/missing session: ${sessionId}`);
          return;
        }

        if (sender === 'merchant') {
          if (sessionObj.assignedAgent && sessionObj.assignedAgent.toString() !== senderId.toString()) {
            console.log(`Blocked message: Agent ${senderId} is not assigned to session ${sessionId}`);
            return;
          }
        }

        const message = await Message.create({
          sessionId,
          sender,
          content,
          fileUrl,
          fileType,
          replyTo,
          senderId,
          senderName,
          senderProfilePic,
          status: 'unread'
        });

        const updateData = {
          lastMessageAt: Date.now(),
          lastMessage: content
        };
        
        // If visitor sends message, increment unread count
        if (sender === 'visitor') {
          updateData.$inc = { unreadCount: 1 };
          updateData.isOfflineLead = false; // Reset offline lead status as they are now active
        }

        const session = await ChatSession.findByIdAndUpdate(
          sessionId, 
          updateData, 
          { new: true }
        );
        
        const roomName = `session_${sessionId}`;
        
        const msgJson = message.toJSON();
        if (tempId) {
          msgJson.tempId = tempId;
        }

        // Broadcast to the specific session room (for visitor)
        io.to(roomName).emit('receive_message', msgJson);
        
        // Broadcast to the merchant's global room to update sidebar and chat area
        const currentMerchantId = merchantId || sessionObj.merchantId?.toString();
        if (currentMerchantId) {
          await notifyMerchants(currentMerchantId, sessionId, 'receive_message', msgJson);
          await notifyMerchants(currentMerchantId, sessionId, 'session_updated', session);
        }

        // Send FCM push notification for visitor messages
        if (sender === 'visitor') {
          try {
            const pushMerchantId = currentMerchantId;
            if (pushMerchantId) {
              let recipientIds = [];
              const isUnassigned = !sessionObj.assignedAgent;
              if (isUnassigned) {
                // Unassigned: notify all agents/admin
                const merchantOwner = await Merchant.findById(pushMerchantId);
                if (merchantOwner) {
                  recipientIds.push(pushMerchantId);
                  if (sessionObj.widgetId && mongoose.Types.ObjectId.isValid(sessionObj.widgetId)) {
                    const widgetObj = merchantOwner.widgets.id(sessionObj.widgetId);
                    if (widgetObj && widgetObj.authorizedUsers) {
                      widgetObj.authorizedUsers.forEach(au => {
                        const uid = au.user ? au.user.toString() : au.toString();
                        if (!recipientIds.includes(uid)) recipientIds.push(uid);
                      });
                    }
                  }
                }
              } else {
                // Assigned: notify only the assigned agent
                recipientIds.push(sessionObj.assignedAgent.toString());
              }

              if (recipientIds.length > 0) {
                // First visitor message = alarm (telephone), subsequent = default
                const prevUnread = sessionObj.unreadCount || 0;
                const isFirstMessage = prevUnread === 0;
                const useAlarm = isFirstMessage && isUnassigned; // Alarm ring ONLY on the first message of an unassigned session
                const visitorLabel = sessionObj.visitorName || 'Visitor';
                await sendPushNotifications(
                  recipientIds,
                  visitorLabel,
                  content || (fileUrl ? '📎 Attachment' : 'New message'),
                  {
                    sessionId: sessionId.toString(),
                    screen: 'chat',
                    soundType: useAlarm ? 'telephone' : 'default',
                    isUnassigned: useAlarm ? 'true' : 'false',
                    visitorName: sessionObj.visitorName || '',
                    visitorEmail: sessionObj.visitorEmail || '',
                    visitorPhone: sessionObj.visitorPhone || '',
                    visitorDomain: sessionObj.visitorDomain || '',
                    visitorPath: sessionObj.visitorPath || '',
                    avatarUrl: senderProfilePic || ''
                  },
                  { android: { priority: 'high' } }
                );
              }
            }
          } catch (pushErr) {
            console.error('Error sending visitor message push notification:', pushErr);
          }
        }


      } catch (err) {
        console.error('Error saving message', err);
      }
    });

    // Join / Enroll in chat session
    socket.on('join_session', async ({ sessionId, agentId, agentName, merchantId }) => {
      try {
        const session = await ChatSession.findById(sessionId);
        if (!session) return;

        // Assign the agent
        session.assignedAgent = agentId;
        session.assignedAgentName = agentName;
        await session.save();

        // Create a system message: "Agent [Name] joined the conversation"
        const systemMsg = await Message.create({
          sessionId: session._id,
          sender: 'system',
          content: `${agentName} joined the conversation`,
          status: 'read'
        });

        const roomName = `session_${sessionId}`;
        
        // Broadcast to visitor and other participants in the room
        io.to(roomName).emit('receive_message', systemMsg);
        
        // Notify all merchants/agents that the session was updated and a message was received
        if (merchantId) {
          await notifyMerchants(merchantId, sessionId, 'receive_message', systemMsg);
          await notifyMerchants(merchantId, sessionId, 'session_updated', session);
        }
      } catch (err) {
        console.error('Error joining session:', err);
      }
    });

    // Leave / Unassign chat session
    socket.on('leave_session', async ({ sessionId, agentName, merchantId }) => {
      try {
        const session = await ChatSession.findById(sessionId);
        if (!session) return;

        session.assignedAgent = null;
        session.assignedAgentName = null;
        await session.save();

        const systemMsg = await Message.create({
          sessionId: session._id,
          sender: 'system',
          content: `${agentName} left the conversation`,
          status: 'read'
        });

        const roomName = `session_${sessionId}`;
        io.to(roomName).emit('receive_message', systemMsg);

        if (merchantId) {
          await notifyMerchants(merchantId, sessionId, 'receive_message', systemMsg);
          await notifyMerchants(merchantId, sessionId, 'session_updated', session);
        }
      } catch (err) {
        console.error('Error leaving session:', err);
      }
    });

    // Mark session as read
    socket.on('mark_as_read', async ({ sessionId, merchantId }) => {
      try {
        const session = await ChatSession.findByIdAndUpdate(sessionId, { unreadCount: 0 }, { new: true });
        if (merchantId) {
          await notifyMerchants(merchantId, sessionId, 'session_updated', session);
        }
      } catch (err) {
        console.error('Error marking as read', err);
      }
    });

    // Edit message
    socket.on('edit_message', async ({ messageId, newContent, sessionId, merchantId }) => {
      try {
        const message = await Message.findByIdAndUpdate(
          messageId, 
          { content: newContent, isEdited: true },
          { new: true }
        );
        const roomName = `session_${sessionId}`;
        io.to(roomName).emit('message_updated', message);
        if (merchantId) await notifyMerchants(merchantId, sessionId, 'message_updated', message);
      } catch (err) {
        console.error('Error editing message', err);
      }
    });

    // Delete message
    socket.on('delete_message', async ({ messageId, sessionId, merchantId }) => {
      try {
        const message = await Message.findByIdAndUpdate(
          messageId,
          { content: 'This message was deleted', isDeleted: true },
          { new: true }
        );
        const roomName = `session_${sessionId}`;
        io.to(roomName).emit('message_updated', message);
        if (merchantId) await notifyMerchants(merchantId, sessionId, 'message_updated', message);
      } catch (err) {
        console.error('Error deleting message', err);
      }
    });

    // Message status update (delivered / read)
    socket.on('messages_status_update', async ({ sessionId, status, merchantId }) => {
      try {
        // Update merchant's messages to 'delivered' or 'read'
        await Message.updateMany(
          { sessionId, sender: 'merchant', status: { $ne: 'read' } },
          { status }
        );
        const roomName = `session_${sessionId}`;
        io.to(roomName).emit('messages_status_updated', { sessionId, status });
        if (merchantId) await notifyMerchants(merchantId, sessionId, 'messages_status_updated', { sessionId, status });
      } catch (err) {
        console.error('Error updating message status', err);
      }
    });

    // Widget state change
    socket.on('widget_state_change', async ({ sessionId, state, merchantId }) => {
      try {
        const session = await ChatSession.findByIdAndUpdate(
          sessionId,
          { visitorStatus: state },
          { new: true }
        );
        if (merchantId) {
          await notifyMerchants(merchantId, sessionId, 'session_updated', session);
        }
      } catch (err) {
        console.error('Error updating widget state', err);
      }
    });

    // Typing indicators
    socket.on('typing_start', async ({ sessionId, sender, merchantId, senderName, senderProfilePic }) => {
      try {
        const sessionObj = await ChatSession.findById(sessionId);
        if (!sessionObj || sessionObj.status === 'closed') return;

        const roomName = `session_${sessionId}`;
        // Broadcast to visitor
        io.to(roomName).emit('typing_start', { sessionId, sender, senderName, senderProfilePic });
        // Broadcast to merchant
        if (merchantId) await notifyMerchants(merchantId, sessionId, 'typing_start', { sessionId, sender, senderName, senderProfilePic });
      } catch (err) {
        console.error('Error typing_start', err);
      }
    });

    socket.on('typing_end', async ({ sessionId, sender, merchantId }) => {
      try {
        const sessionObj = await ChatSession.findById(sessionId);
        if (!sessionObj || sessionObj.status === 'closed') return;

        const roomName = `session_${sessionId}`;
        io.to(roomName).emit('typing_end', { sessionId, sender });
        if (merchantId) await notifyMerchants(merchantId, sessionId, 'typing_end', { sessionId, sender });
      } catch (err) {
        console.error('Error typing_end', err);
      }
    });

    // Agent starts/stops viewing a specific session actively
    socket.on('agent_viewing_session', ({ sessionId, name, profilePic, agentId }) => {
      cleanupViewing(socket);
      if (sessionId) {
        socket.viewingSessionId = sessionId;
        socket.agentInfo = { agentId, name, profilePic };
        socket.join(`session_${sessionId}`);
        
        if (!sessionViewers[sessionId]) {
          sessionViewers[sessionId] = {};
        }
        sessionViewers[sessionId][socket.id] = { agentId, name, profilePic };
        sendActiveViewersUpdate(sessionId);
      }
    });

    // Close session
    socket.on('close_session', async ({ sessionId }) => {
      try {
        const session = await ChatSession.findById(sessionId);
        if (session && session.status !== 'closed') {
          await closeSessionHelper(session);
        }
      } catch (err) {
        console.error('Error closing session', err);
      }
    });

    // WebRTC calling events
    socket.on('call_request', async ({ sessionId, callerName, callerType }) => {
      try {
        const session = await ChatSession.findById(sessionId);
        if (!session || session.status === 'closed') return;

        const roomName = `session_${sessionId}`;

        if (callerType === 'visitor') {
          // If visitor calls, notify the merchant room globally so the agent gets it anywhere.
          // Agents viewing the chat are also listening to the merchant room, so this avoids duplicate event delivery.
          if (session.merchantId) {
            await notifyMerchants(session.merchantId, sessionId, 'incoming_call', {
              sessionId,
              callerName,
              callerType,
              visitorName: session.visitorName
            });
          }
        } else {
          // If merchant calls, broadcast incoming call to the visitor in the session room
          socket.to(roomName).emit('incoming_call', {
            sessionId,
            callerName,
            callerType,
            visitorName: session.visitorName
          });
        }
      } catch (err) {
        console.error('Error in call_request socket event:', err);
      }
    });


    socket.on('call_accept', ({ sessionId }) => {
      socket.to(`session_${sessionId}`).emit('call_accepted', { sessionId });
    });

    socket.on('call_reject', ({ sessionId, reason }) => {
      socket.to(`session_${sessionId}`).emit('call_rejected', { sessionId, reason });
      if (socket.merchantId) {
        io.to(socket.merchantId.toString()).emit('call_rejected', { sessionId, reason });
      }
    });

    socket.on('webrtc_offer', ({ sessionId, offer }) => {
      socket.to(`session_${sessionId}`).emit('webrtc_offer_received', { sessionId, offer });
    });

    socket.on('webrtc_answer', ({ sessionId, answer }) => {
      socket.to(`session_${sessionId}`).emit('webrtc_answer_received', { sessionId, answer });
    });

    socket.on('webrtc_ice', ({ sessionId, candidate }) => {
      socket.to(`session_${sessionId}`).emit('webrtc_ice_received', { sessionId, candidate });
    });

    socket.on('call_hangup', ({ sessionId }) => {
      socket.to(`session_${sessionId}`).emit('call_hungup', { sessionId });
      if (socket.merchantId) {
        io.to(socket.merchantId.toString()).emit('call_hungup', { sessionId });
      }
    });

    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.id);
      cleanupViewing(socket);
      
      if (socket.merchantId) {
        try {
          const sockets = await io.in(socket.merchantId.toString()).fetchSockets();
          if (sockets.length === 0) {
            connectedAgents.delete(socket.merchantId.toString());
          }
        } catch (err) {
          console.error('Error on agent disconnect cleanup:', err);
        }
      }

      if (socket.sessionId) {
        try {
          const session = await ChatSession.findByIdAndUpdate(
            socket.sessionId,
            { visitorStatus: 'offline' },
            { new: true }
          );
          if (socket.merchantId) {
            await notifyMerchants(socket.merchantId, socket.sessionId, 'session_updated', session);
          }
        } catch (err) {
          console.error('Error handling visitor disconnect offline status', err);
        }
      }
    });
  });
};

