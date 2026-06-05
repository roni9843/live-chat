const mongoose = require('mongoose');
const ChatSession = require('../models/ChatSession');
const Message = require('../models/Message');
const Merchant = require('../models/Merchant');

const sessionViewers = {}; // sessionId -> { socketId: { agentId, name, profilePic } }

module.exports = (io) => {
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
    socket.on('get_chat_history', async (sessionId) => {
      try {
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

        // Notify merchant
        await notifyMerchants(merchantId, session._id, 'new_session', session);

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
    socket.on('send_message', async ({ sessionId, sender, content, merchantId, fileUrl, fileType, replyTo, senderId, senderName, senderProfilePic }) => {
      try {
        const sessionObj = await ChatSession.findById(sessionId);
        if (!sessionObj || sessionObj.status === 'closed') {
          console.log(`Blocked message sending to closed/missing session: ${sessionId}`);
          return;
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
          senderProfilePic
        });

        const updateData = {
          lastMessageAt: Date.now(),
          lastMessage: content
        };
        
        // If visitor sends message, increment unread count
        if (sender === 'visitor') {
          updateData.$inc = { unreadCount: 1 };
        }

        const session = await ChatSession.findByIdAndUpdate(
          sessionId, 
          updateData, 
          { new: true }
        );
        
        const roomName = `session_${sessionId}`;
        
        // Broadcast to the specific session room (for visitor)
        io.to(roomName).emit('receive_message', message);
        
        // Broadcast to the merchant's global room to update sidebar and chat area
        if (merchantId) {
          await notifyMerchants(merchantId, sessionId, 'receive_message', message);
          await notifyMerchants(merchantId, sessionId, 'session_updated', session);
        }

      } catch (err) {
        console.error('Error saving message', err);
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

    socket.on('disconnect', async () => {
      console.log('User disconnected:', socket.id);
      cleanupViewing(socket);
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
          console.error('Error handling disconnect offline status', err);
        }
      }
    });
  });
};

