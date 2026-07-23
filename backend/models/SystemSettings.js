const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
  newMessageSound: { 
    type: String, 
    default: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' 
  },
  sendMessageSound: { 
    type: String, 
    default: '/sound-effect/mixkit-hard-pop-click-2364.wav' 
  },
  deleteMessageSound: { 
    type: String, 
    default: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' 
  }
}, { timestamps: true });

// Ensure we only have one document
systemSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
