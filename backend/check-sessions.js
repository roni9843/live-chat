const mongoose = require('mongoose');
const MONGODB_URI = 'mongodb://roniAdmin:StrongPassword123!@76.13.247.13:27017/oracle-chat?authSource=admin';

const chatSessionSchema = new mongoose.Schema({
  merchantId: mongoose.Schema.Types.ObjectId,
  visitorId: String,
  visitorName: String,
  isDirectMessage: Boolean,
  isGroupChat: Boolean,
  participants: [mongoose.Schema.Types.ObjectId]
});

const ChatSession = mongoose.model('ChatSession', chatSessionSchema, 'chatsessions');

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected');
    const sessions = await ChatSession.find({});
    console.log('Total sessions:', sessions.length);
    for (const s of sessions) {
      console.log(`- ID: ${s._id}, Name: ${s.visitorName}, DM: ${s.isDirectMessage}, Group: ${s.isGroupChat}, Participants: ${s.participants}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
