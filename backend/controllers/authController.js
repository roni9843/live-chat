const Merchant = require('../models/Merchant');
const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'your_super_secret_jwt_key_here', {
    expiresIn: '30d',
  });
};

// @desc    Register a new merchant
// @route   POST /api/auth/merchant/register
exports.registerMerchant = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const merchantExists = await Merchant.findOne({ email });

    if (merchantExists) {
      return res.status(400).json({ message: 'Merchant already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const merchant = await Merchant.create({
      name,
      email,
      password: hashedPassword,
    });

    if (merchant) {
      res.status(201).json({
        _id: merchant.id,
        name: merchant.name,
        email: merchant.email,
        canCreateWidgets: merchant.canCreateWidgets,
        profilePic: merchant.profilePic || '',
        token: generateToken(merchant._id, 'merchant'),
      });
    } else {
      res.status(400).json({ message: 'Invalid merchant data' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Authenticate a merchant
// @route   POST /api/auth/merchant/login
exports.loginMerchant = async (req, res) => {
  const { email, password } = req.body;

  try {
    const merchant = await Merchant.findOne({ email })
      .populate('widgets.authorizedUsers.user', 'name email')
      .populate('widgets.pendingUsers.user', 'name email');

    if (merchant && (await bcrypt.compare(password, merchant.password))) {
      res.json({
        _id: merchant.id,
        name: merchant.name,
        email: merchant.email,
        canCreateWidgets: merchant.canCreateWidgets,
        role: merchant.role,
        widgets: merchant.widgets,
        profilePic: merchant.profilePic || '',
        status: merchant.status || 'online',
        schedule: merchant.schedule || { enabled: false, start: '09:00', end: '18:00' },
        token: generateToken(merchant._id, 'merchant'),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Authenticate an admin
// @route   POST /api/auth/admin/login
exports.loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await Admin.findOne({ email });

    if (admin && (await bcrypt.compare(password, admin.password))) {
      res.json({
        _id: admin.id,
        email: admin.email,
        role: admin.role,
        token: generateToken(admin._id, 'admin'),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get merchant profile
// @route   GET /api/auth/merchant/profile
exports.getMerchantProfile = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.user._id)
      .select('-password')
      .populate('widgets.authorizedUsers.user', 'name email')
      .populate('widgets.pendingUsers.user', 'name email');
    if (merchant) {
      // Find widgets owned by other merchants where this user is authorized
      const otherMerchants = await Merchant.find({ 
        'widgets.authorizedUsers.user': req.user._id 
      })
      .populate('widgets.authorizedUsers.user', 'name email')
      .populate('widgets.pendingUsers.user', 'name email');
      
      let sharedWidgets = [];
      otherMerchants.forEach(owner => {
        owner.widgets.forEach(widget => {
          const authUser = widget.authorizedUsers.find(au => {
            const userId = au.user?._id || au.user;
            return userId && userId.toString() === req.user._id.toString();
          });
          if (authUser) {
            // Include owner info and the user's role on this widget
            sharedWidgets.push({
              ...widget.toObject(),
              ownerName: owner.name,
              ownerEmail: owner.email,
              myRole: authUser.role
            });
          }
        });
      });

      const profileData = merchant.toObject();
      profileData.sharedWidgets = sharedWidgets;
      
      res.json(profileData);
    } else {
      res.status(404).json({ message: 'Merchant not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update merchant profile
// @route   PUT /api/auth/merchant/profile
exports.updateMerchantProfile = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.user._id);

    if (merchant) {
      merchant.name = req.body.name || merchant.name;
      merchant.email = req.body.email || merchant.email;
      merchant.websiteUrl = req.body.websiteUrl || merchant.websiteUrl;
      if (req.body.profilePic !== undefined) {
        merchant.profilePic = req.body.profilePic;
      }
      if (req.body.status !== undefined) {
        merchant.status = req.body.status;
      }
      if (req.body.schedule !== undefined) {
        merchant.schedule = req.body.schedule;
      }
      
      if (req.body.widgets) {
        merchant.widgets = req.body.widgets;
      }

      const updatedMerchant = await merchant.save();
      await updatedMerchant.populate('widgets.authorizedUsers.user', 'name email');
      await updatedMerchant.populate('widgets.pendingUsers.user', 'name email');

      res.json({
        _id: updatedMerchant._id,
        name: updatedMerchant.name,
        email: updatedMerchant.email,
        websiteUrl: updatedMerchant.websiteUrl,
        widgets: updatedMerchant.widgets,
        profilePic: updatedMerchant.profilePic || '',
        status: updatedMerchant.status || 'online',
        schedule: updatedMerchant.schedule || { enabled: false, start: '09:00', end: '18:00' },
        token: generateToken(updatedMerchant._id, 'merchant'),
      });
    } else {
      res.status(404).json({ message: 'Merchant not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Change merchant password
// @route   PUT /api/auth/merchant/password
exports.changeMerchantPassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const merchant = await Merchant.findById(req.user._id);

    if (merchant && (await bcrypt.compare(currentPassword, merchant.password))) {
      const salt = await bcrypt.genSalt(10);
      merchant.password = await bcrypt.hash(newPassword, salt);
      await merchant.save();

      res.json({ message: 'Password updated successfully' });
    } else {
      res.status(401).json({ message: 'Incorrect current password' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Add new widget
// @route   POST /api/auth/merchant/widgets
exports.addWidget = async (req, res) => {
  const { domain, companyName } = req.body;
  
  if (!req.user.canCreateWidgets) {
    return res.status(403).json({ message: 'Access denied. You do not have permission to create widgets.' });
  }

  try {
    const merchant = await Merchant.findById(req.user._id);
    if (merchant) {
      const newWidget = { domain, companyName };
      merchant.widgets.push(newWidget);
      await merchant.save();
      // Return the newly created widget which is the last one in the array
      res.json(merchant.widgets[merchant.widgets.length - 1]);
    } else {
      res.status(404).json({ message: 'Merchant not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update a widget
// @route   PUT /api/auth/merchant/widgets/:widgetId
exports.updateWidget = async (req, res) => {
  const { 
    domain, companyName, color, position, title, allowedDomains, isActive, 
    authorizedUsers, pendingUsers, welcomeMessage, spacingBottom, spacingSide,
    launcherType, launcherText, themeMode, bgType, bgColor, bgImage,
    ownerNickname, ownerDesignation, ownerProfilePic, faqs, preChatForm, logo, offlineForm
  } = req.body;
  try {
    const merchant = await Merchant.findOne({ "widgets._id": req.params.widgetId });
    if (merchant) {
      const widget = merchant.widgets.id(req.params.widgetId);
      if (widget) {
        const isOwner = merchant._id.toString() === req.user._id.toString();
        const isWidgetAdmin = widget.authorizedUsers.some(au => au.user && au.user.toString() === req.user._id.toString() && au.role === 'admin');
        
        if (!isOwner && !isWidgetAdmin) {
          return res.status(403).json({ message: 'Access denied. You do not have admin permissions for this widget.' });
        }

        if (domain) widget.domain = domain;
        if (companyName) widget.companyName = companyName;
        if (color) widget.color = color;
        if (position) widget.position = position;
        if (title) widget.title = title;
        if (welcomeMessage) widget.welcomeMessage = welcomeMessage;
        if (spacingBottom !== undefined) widget.spacingBottom = spacingBottom;
        if (spacingSide !== undefined) widget.spacingSide = spacingSide;
        if (launcherType) widget.launcherType = launcherType;
        if (launcherText) widget.launcherText = launcherText;
        if (themeMode) widget.themeMode = themeMode;
        if (bgType) widget.bgType = bgType;
        if (bgColor) widget.bgColor = bgColor;
        if (bgImage !== undefined) widget.bgImage = bgImage;
        if (ownerNickname !== undefined) widget.ownerNickname = ownerNickname;
        if (ownerDesignation !== undefined) widget.ownerDesignation = ownerDesignation;
        if (ownerProfilePic !== undefined) widget.ownerProfilePic = ownerProfilePic;
        if (allowedDomains) widget.allowedDomains = allowedDomains;
        if (isActive !== undefined) widget.isActive = isActive;
        if (authorizedUsers) widget.authorizedUsers = authorizedUsers;
        if (pendingUsers) widget.pendingUsers = pendingUsers;
        if (faqs !== undefined) widget.faqs = faqs;
        if (preChatForm !== undefined) widget.preChatForm = preChatForm;
        if (logo !== undefined) widget.logo = logo;
        if (offlineForm !== undefined) widget.offlineForm = offlineForm;
        
        await merchant.save();
        await merchant.populate('widgets.authorizedUsers.user', 'name email');
        await merchant.populate('widgets.pendingUsers.user', 'name email');
        const updatedWidget = merchant.widgets.id(req.params.widgetId);
        res.json(updatedWidget);
      } else {
        res.status(404).json({ message: 'Widget not found' });
      }
    } else {
      res.status(404).json({ message: 'Widget not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete a widget
// @route   DELETE /api/auth/merchant/widgets/:widgetId
exports.deleteWidget = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.user._id);
    if (merchant) {
      merchant.widgets.pull(req.params.widgetId);
      await merchant.save();
      res.json({ message: 'Widget removed' });
    } else {
      res.status(404).json({ message: 'Merchant not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getWidgetPublic = async (req, res) => {
  try {
    let queryWidgetId = req.params.widgetId;
    let merchant;

    // Developer fallback to make client test environment load dynamic widget styles out-of-the-box
    if (queryWidgetId === 'temp_widget_id') {
      merchant = await Merchant.findOne({ "widgets.0": { $exists: true } })
        .populate('widgets.authorizedUsers.user', 'name profilePic status schedule');
      if (merchant && merchant.widgets.length > 0) {
        queryWidgetId = merchant.widgets[0]._id;
      }
    } else {
      merchant = await Merchant.findOne({ "widgets._id": queryWidgetId })
        .populate('widgets.authorizedUsers.user', 'name profilePic status schedule');
    }

    if (merchant) {
      const widget = merchant.widgets.id(queryWidgetId);
      
      const connectedAgents = req.app.get('connectedAgents') || new Set();

      const isAgentOnline = (agentUser) => {
        if (!agentUser) return false;
        
        // 1. Must be connected to socket
        const isConnected = connectedAgents.has(agentUser._id.toString());
        if (!isConnected) return false;

        // 2. Must not be manually toggled offline
        if (agentUser.status === 'offline') return false;

        // 3. If schedule is enabled, check current time in HH:mm format
        if (agentUser.schedule && agentUser.schedule.enabled) {
          const now = new Date();
          const currentHour = now.getHours().toString().padStart(2, '0');
          const currentMinute = now.getMinutes().toString().padStart(2, '0');
          const currentTimeString = `${currentHour}:${currentMinute}`;
          
          const { start, end } = agentUser.schedule;
          if (start && end) {
            if (start <= end) {
              if (currentTimeString < start || currentTimeString > end) {
                return false;
              }
            } else {
              // Overnight schedule (e.g. 22:00 to 06:00)
              if (currentTimeString < start && currentTimeString > end) {
                return false;
              }
            }
          }
        }
        return true;
      };

      const isOwnerOnline = isAgentOnline(merchant);
      let isAnyAgentOnline = false;

      if (widget.authorizedUsers) {
        isAnyAgentOnline = widget.authorizedUsers.some(au => au.user && isAgentOnline(au.user));
      }

      const isWidgetOnline = isOwnerOnline || isAnyAgentOnline;

      // Compile representatives/agents
      const agents = [];
      const ownerName = widget.ownerNickname || merchant.name;
      const ownerPic = widget.ownerProfilePic || merchant.profilePic || '';
      const ownerDesignation = widget.ownerDesignation || 'Owner';

      agents.push({
        userId: merchant._id.toString(),
        name: ownerName,
        profilePic: ownerPic,
        designation: ownerDesignation
      });

      if (widget.authorizedUsers) {
        widget.authorizedUsers.forEach(au => {
          if (au.user) {
            const agentName = au.nickname || au.user.name;
            const agentPic = au.profilePic || au.user.profilePic || '';
            const agentDesignation = au.designation || 'Support Agent';
            agents.push({
              userId: au.user._id.toString(),
              name: agentName,
              profilePic: agentPic,
              designation: agentDesignation
            });
          }
        });
      }

      // Return only necessary public info
      res.json({
        merchantId: merchant._id,
        widgetId: widget._id,
        companyName: widget.companyName,
        domain: widget.domain,
        color: widget.color,
        title: widget.title,
        position: widget.position,
        welcomeMessage: widget.welcomeMessage,
        spacingBottom: widget.spacingBottom,
        spacingSide: widget.spacingSide,
        launcherType: widget.launcherType,
        launcherText: widget.launcherText,
        themeMode: widget.themeMode,
        bgType: widget.bgType || 'image',
        bgColor: widget.bgColor || '#efeae2',
        bgImage: widget.bgImage || 'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png',
        logo: widget.logo || '',
        agents,
        faqs: widget.faqs || [],
        preChatForm: widget.preChatForm,
        isWidgetOnline,
        offlineForm: widget.offlineForm || {
          enabled: true,
          title: 'Leave a message',
          message: 'All agents are offline. Please state your problems and post them.',
          fields: [
            { id: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Enter your name...' },
            { id: 'email', label: 'Email', type: 'email', required: true, placeholder: 'Enter your email...' },
            { id: 'phone', label: 'Phone Number', type: 'tel', required: false, placeholder: 'Enter your phone number...' },
            { id: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'Describe your issue...' }
          ]
        }
      });
    } else {
      res.status(404).json({ message: 'Widget not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Search merchants by email
// @route   GET /api/auth/merchant/search?email=...
exports.searchMerchants = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ message: 'Email query parameter is required' });
    }
    const merchants = await Merchant.find({ 
      email: { $regex: email, $options: 'i' },
      _id: { $ne: req.user._id } 
    }).select('name email _id').limit(10);
    
    res.json(merchants);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Invite user to widget
// @route   POST /api/auth/merchant/widgets/:widgetId/invite
exports.inviteUserToWidget = async (req, res) => {
  const { widgetId } = req.params;
  const { email, role } = req.body;

  try {
    const merchant = await Merchant.findOne({ "widgets._id": widgetId });
    if (!merchant) {
      return res.status(404).json({ message: 'Widget not found' });
    }

    const widget = merchant.widgets.id(widgetId);
    
    // Check if the current user is authorized to admin this widget
    const isOwner = merchant._id.toString() === req.user._id.toString();
    const isWidgetAdmin = widget.authorizedUsers.some(au => au.user && au.user.toString() === req.user._id.toString() && au.role === 'admin');
    
    if (!isOwner && !isWidgetAdmin) {
      return res.status(403).json({ message: 'Access denied. You do not have admin permissions for this widget.' });
    }

    const userToInvite = await Merchant.findOne({ email });
    if (!userToInvite) {
      return res.status(404).json({ message: 'User with this email is not registered on the platform.' });
    }

    // Check if user is already authorized
    const isAlreadyAuthorized = widget.authorizedUsers.some(au => au.user && au.user.toString() === userToInvite._id.toString());
    if (isAlreadyAuthorized) {
      return res.status(400).json({ message: 'User is already authorized for this widget.' });
    }

    // Check if user is already in pending
    const isAlreadyPending = widget.pendingUsers.some(pu => pu.user && pu.user.toString() === userToInvite._id.toString());
    if (isAlreadyPending) {
      return res.status(400).json({ message: 'User already has a pending invitation for this widget.' });
    }

    widget.pendingUsers.push({ user: userToInvite._id, role: role || 'agent' });
    await merchant.save();
    await merchant.populate('widgets.pendingUsers.user', 'name email');
    await merchant.populate('widgets.authorizedUsers.user', 'name email');

    // Notify target user via socket
    const io = req.app.get('io');
    if (io) {
      io.to(userToInvite._id.toString()).emit('new_invite', {
        widgetId: widget._id,
        domain: widget.domain,
        companyName: widget.companyName,
        ownerName: merchant.name,
        ownerEmail: merchant.email,
        role: role || 'agent'
      });
    }

    res.json(merchant.widgets.id(widgetId));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get pending invites
// @route   GET /api/auth/merchant/invites
exports.getPendingInvites = async (req, res) => {
  try {
    // Find merchants who have this user in their widget's pendingUsers.user
    const owners = await Merchant.find({ 'widgets.pendingUsers.user': req.user._id });
    
    let invites = [];
    owners.forEach(owner => {
      owner.widgets.forEach(widget => {
        const pending = widget.pendingUsers.find(pu => pu.user && pu.user.toString() === req.user._id.toString());
        if (pending) {
          invites.push({
            widgetId: widget._id,
            domain: widget.domain,
            companyName: widget.companyName,
            ownerName: owner.name,
            ownerEmail: owner.email,
            role: pending.role
          });
        }
      });
    });

    res.json(invites);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Respond to an invite
// @route   POST /api/auth/merchant/invites/:widgetId/respond
exports.respondToInvite = async (req, res) => {
  const action = req.body.action || req.body.status; // Support both action and status from client
  const { widgetId } = req.params;
  
  try {
    const merchants = await Merchant.find({ 'widgets._id': widgetId });
    let ownerMerchant = null;
    let foundWidget = null;
    let pendingUserObj = null;

    for (let owner of merchants) {
      for (let widget of owner.widgets) {
        const pending = widget.pendingUsers.find(pu => pu.user && pu.user.toString() === req.user._id.toString());
        if (widget._id.toString() === widgetId && pending) {
          foundWidget = widget;
          pendingUserObj = pending;
          ownerMerchant = owner;
          break;
        }
      }
      if (foundWidget) break;
    }

    if (!foundWidget) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    if (action === 'accept') {
      foundWidget.authorizedUsers.push({ user: req.user._id, role: pendingUserObj.role });
      foundWidget.pendingUsers = foundWidget.pendingUsers.filter(pu => pu.user.toString() !== req.user._id.toString());
    } else if (action === 'reject' || action === 'cancel') {
      foundWidget.pendingUsers = foundWidget.pendingUsers.filter(pu => pu.user.toString() !== req.user._id.toString());
    } else if (action === 'remove_authorized') {
      // Allow widget owner to remove an authorized user
      foundWidget.authorizedUsers = foundWidget.authorizedUsers.filter(au => au.user.toString() !== req.user._id.toString());
    }

    await ownerMerchant.save();

    // Notify owner
    const io = req.app.get('io');
    if (io) {
      const responder = await Merchant.findById(req.user._id);
      io.to(ownerMerchant._id.toString()).emit('invite_responded', {
        widgetId,
        responderName: responder.name,
        responderEmail: responder.email,
        action
      });
    }

    res.json({ message: `Invite ${action}ed successfully` });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.postOfflineMessage = async (req, res) => {
  const { widgetId } = req.params;
  const { visitorId, visitorName, visitorEmail, visitorPhone, visitorDomain, visitorPath, message, fields } = req.body;
  
  try {
    const ChatSession = require('../models/ChatSession');
    const Message = require('../models/Message');

    // Find the widget owner
    const owner = await Merchant.findOne({ "widgets._id": widgetId });
    if (!owner) {
      return res.status(404).json({ message: 'Widget not found' });
    }
    
    const widget = owner.widgets.id(widgetId);

    // Check if there is an active session already
    let session = await ChatSession.findOne({ merchantId: owner._id, visitorId, status: 'active' });
    
    if (!session) {
      session = await ChatSession.create({
        merchantId: owner._id,
        widgetId,
        source: widget.companyName || 'Website',
        visitorId,
        visitorName: visitorName || 'Guest',
        visitorEmail: visitorEmail || '',
        visitorPhone: visitorPhone || '',
        visitorDetails: message || '',
        visitorDomain: visitorDomain || 'Unknown',
        visitorPath: visitorPath || '/',
        visitorStatus: 'offline',
        isOfflineLead: true,
        offlineFields: fields || {}
      });
    } else {
      session.isOfflineLead = true;
      if (fields) {
        session.offlineFields = fields;
      }
      await session.save();
    }

    // Create message from visitor
    const visitorMsg = await Message.create({
      sessionId: session._id,
      sender: 'visitor',
      content: message || 'Offline lead submitted',
      status: 'unread'
    });

    session.lastMessage = message || 'Offline lead submitted';
    session.lastMessageAt = Date.now();
    session.unreadCount = (session.unreadCount || 0) + 1;
    await session.save();

    // Notify merchant room
    const io = req.app.get('io');
    if (io) {
      io.to(owner._id.toString()).emit('new_session', session);
      io.to(owner._id.toString()).emit('receive_message', visitorMsg);
      // Also notify any authorized users
      if (widget.authorizedUsers) {
        widget.authorizedUsers.forEach(au => {
          const uid = au.user ? au.user.toString() : au.toString();
          io.to(uid).emit('new_session', session);
          io.to(uid).emit('receive_message', visitorMsg);
        });
      }
    }

    res.json({ success: true, session });
  } catch (error) {
    console.error('Error posting offline message:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
