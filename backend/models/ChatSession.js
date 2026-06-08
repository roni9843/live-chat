const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema({
  merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', required: true },
  widgetId: { type: String }, // To identify which widget this chat came from
  source: { type: String, default: 'Website' }, // Store company name or domain
  visitorId: { type: String, required: true }, // unique identifier for the visitor (socket id or generated id)
  visitorName: { type: String, default: 'Guest' },
  visitorEmail: { type: String },
  visitorPhone: { type: String },
  visitorDetails: { type: String },
  visitorDomain: { type: String, default: 'Unknown' },
  visitorPath: { type: String, default: '/' },
  visitorStatus: { type: String, enum: ['online', 'minimized', 'offline', 'active'], default: 'online' },
  status: { type: String, enum: ['active', 'closed'], default: 'active' },
  lastMessage: { type: String }, // Store the text of the last message
  unreadCount: { type: Number, default: 0 }, // Number of unread messages for the merchant
  lastMessageAt: { type: Date, default: Date.now },
  assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant', default: null },
  assignedAgentName: { type: String, default: null },
  isOfflineLead: { type: Boolean, default: false },
  offlineFields: { type: Map, of: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ChatSession', chatSessionSchema);
