const mongoose = require('mongoose');
const { initializeApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

const MONGODB_URI = 'mongodb://roniAdmin:StrongPassword123!@76.13.247.13:27017/oracle-chat?authSource=admin';

// Initialize Firebase Admin
try {
  const serviceAccount = require('../firebase-admin-key.json');
  initializeApp({
    credential: cert(serviceAccount)
  });
  console.log('Firebase Admin SDK initialized.');
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
}

const merchantSchema = new mongoose.Schema({
  name: String,
  email: String,
  pushTokens: [String],
});

const Merchant = mongoose.model('Merchant', merchantSchema, 'merchants');

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Find merchants with FCM tokens (not Expo tokens)
    const merchants = await Merchant.find({});
    let fcmTokens = [];
    for (const m of merchants) {
      if (m.pushTokens) {
        for (const token of m.pushTokens) {
          if (!token.startsWith('ExponentPushToken')) {
            fcmTokens.push({ name: m.name, token });
          }
        }
      }
    }

    if (fcmTokens.length === 0) {
      console.log('No native FCM tokens found in the database. Please make sure you logged in on the Android app.');
      return;
    }

    console.log(`Found ${fcmTokens.length} native FCM tokens. Sending test message...`);
    for (const item of fcmTokens) {
      console.log(`Sending to ${item.name} (${item.token.substring(0, 15)}...):`);
      const payload = {
        token: item.token,
        data: {
          title: 'Test Notification',
          body: 'This is a test notification from the script',
          sessionId: 'test_session_id'
        },
        android: {
          priority: 'high'
        }
      };

      try {
        const response = await getMessaging().send(payload);
        console.log(`- Success: ${response}`);
      } catch (err) {
        console.error(`- Error: ${err.message}`, err);
      }
    }
  } catch (err) {
    console.error('Database/Script error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
