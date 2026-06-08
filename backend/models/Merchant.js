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
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Merchant', merchantSchema);
