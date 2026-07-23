const mongoose = require('mongoose');

const merchantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  canCreateWidgets: { type: Boolean, default: false },
  role: { type: String, enum: ['super_admin', 'user'], default: 'user' },
  websiteUrl: { type: String },
  profilePic: { type: String, default: '' },
  widgets: [{
    domain: { type: String, required: true },
    companyName: { type: String, required: true },
    color: { type: String, default: '#25D366' },
    position: { type: String, default: 'right' },
    title: { type: String, default: 'Chat with us' },
    welcomeMessage: { type: String, default: "Welcome! We're here to help you live chat with your visitors." },
    spacingBottom: { type: Number, default: 20 },
    spacingSide: { type: Number, default: 20 },
    launcherType: { type: String, enum: ['icon_only', 'text_and_icon', 'side_tab'], default: 'icon_only' },
    launcherText: { type: String, default: 'Chat' },
    themeMode: { type: String, enum: ['light', 'dark'], default: 'light' },
    bgType: { type: String, enum: ['solid', 'image'], default: 'image' },
    bgColor: { type: String, default: '#efeae2' },
    bgImage: { type: String, default: 'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png' },
    ownerNickname: { type: String, default: '' },
    ownerDesignation: { type: String, default: '' },
    ownerProfilePic: { type: String, default: '' },
    allowedDomains: [{ type: String }],
    isActive: { type: Boolean, default: true },
    authorizedUsers: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant' },
      role: { type: String, enum: ['admin', 'agent'], default: 'agent' },
      nickname: { type: String, default: '' },
      designation: { type: String, default: '' },
      profilePic: { type: String, default: '' }
    }],
    pendingUsers: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant' },
      role: { type: String, enum: ['admin', 'agent'], default: 'agent' }
    }],
    faqs: [{
      question: { type: String, default: '' },
      answer: { type: String, default: '' }
    }],
    preChatForm: {
      enabled: { type: Boolean, default: false },
      fields: {
        name: {
          enabled: { type: Boolean, default: true },
          required: { type: Boolean, default: true },
          label: { type: String, default: 'Name' },
          placeholder: { type: String, default: 'Enter your name...' }
        },
        email: {
          enabled: { type: Boolean, default: true },
          required: { type: Boolean, default: true },
          label: { type: String, default: 'Email' },
          placeholder: { type: String, default: 'Enter your email...' }
        },
        phone: {
          enabled: { type: Boolean, default: false },
          required: { type: Boolean, default: false },
          label: { type: String, default: 'Phone Number' },
          placeholder: { type: String, default: 'Enter your phone number...' }
        },
        message: {
          enabled: { type: Boolean, default: false },
          required: { type: Boolean, default: false },
          label: { type: String, default: 'Message' },
          placeholder: { type: String, default: 'How can we help you?' }
        }
      }
    },
    logo: { type: String, default: '' },
    status: { type: String, enum: ['online', 'offline'], default: 'online' },
    schedule: {
      enabled: { type: Boolean, default: false },
      start: { type: String, default: '09:00' },
      end: { type: String, default: '18:00' }
    },
    offlineForm: {
      enabled: { type: Boolean, default: true },
      title: { type: String, default: 'Leave a message' },
      message: { type: String, default: 'All agents are offline. Please state your problems and post them.' },
      fields: {
        type: [{
          id: { type: String, required: true },
          label: { type: String, required: true },
          type: { type: String, default: 'text' },
          required: { type: Boolean, default: true },
          placeholder: { type: String, default: '' }
        }],
        default: [
          { id: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Enter your name...' },
          { id: 'email', label: 'Email', type: 'email', required: true, placeholder: 'Enter your email...' },
          { id: 'phone', label: 'Phone Number', type: 'tel', required: false, placeholder: 'Enter your phone number...' },
          { id: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'Describe your issue...' }
        ]
      }
    },
    createdAt: { type: Date, default: Date.now }
  }],
  status: { type: String, enum: ['online', 'offline'], default: 'online' },
  schedule: {
    enabled: { type: Boolean, default: false },
    start: { type: String, default: '09:00' },
    end: { type: String, default: '18:00' }
  },
  pushTokens: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Merchant', merchantSchema);
