const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatSession', required: true },
  sender: { type: String, enum: ['merchant', 'visitor', 'system'], required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant' },
  senderName: { type: String },
  senderProfilePic: { type: String },
  content: { type: String }, // optional now, in case it's just a file
  fileUrl: { type: String },
  fileType: { type: String },
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  isDeleted: { type: Boolean, default: false },
  isEdited: { type: Boolean, default: false },
  replyTo: {
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    content: { type: String },
    sender: { type: String }
  }
});

module.exports = mongoose.model('Message', messageSchema);
