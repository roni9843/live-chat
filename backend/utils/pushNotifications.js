const { Expo } = require('expo-server-sdk');
const Merchant = require('../models/Merchant');
const { initializeApp, cert } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const path = require('path');
const fs = require('fs');

const logDebug = (msg) => {
  try {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(path.join(__dirname, '../fcm-debug.log'), `[${timestamp}] ${msg}\n`);
  } catch (e) {
    console.error('Logging failed', e);
  }
};

// Initialize Firebase Admin
try {
  const serviceAccount = require('../firebase-admin-key.json');
  initializeApp({
    credential: cert(serviceAccount)
  });
  console.log('Firebase Admin SDK initialized successfully.');
  logDebug('Firebase Admin SDK initialized successfully.');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
  logDebug(`Error initializing Firebase Admin SDK: ${error.message}`);
}

const expo = new Expo();

/**
 * Sends push notifications to specified merchant IDs
 * @param {Array<string>} userIds - Recipient merchant database IDs
 * @param {string} title - Push Notification Title
 * @param {string} body - Push Notification Body
 * @param {object} data - Custom payload
 */
exports.sendPushNotifications = async (userIds, title, body, data = {}, options = {}) => {
  logDebug(`sendPushNotifications called for userIds: ${JSON.stringify(userIds)}, title: ${title}, body: ${body}`);
  if (!userIds || userIds.length === 0) {
    logDebug('No userIds provided. Exiting.');
    return;
  }

  try {
    const merchants = await Merchant.find({ _id: { $in: userIds } }).select('pushTokens');
    logDebug(`Found ${merchants.length} matching merchants in database.`);
    
    let expoMessages = [];
    let fcmTokens = [];
    let tokenToMerchantMap = {};

    for (const merchant of merchants) {
      logDebug(`Merchant ${merchant._id} (${merchant.name}) has pushTokens: ${JSON.stringify(merchant.pushTokens)}`);
      if (!merchant.pushTokens || merchant.pushTokens.length === 0) continue;

      for (const token of merchant.pushTokens) {
        tokenToMerchantMap[token] = merchant;
        
        if (Expo.isExpoPushToken(token)) {
          const msgObj = {
            to: token,
            sound: 'default',
            title: title,
            body: body,
            data: data,
            priority: 'high',
            channelId: 'default',
          };

          if (options.categoryIdentifier) {
            msgObj.categoryIdentifier = options.categoryIdentifier;
          }
          if (options.android) {
            msgObj.android = options.android;
          }
          if (options.ios) {
            msgObj.ios = options.ios;
          }
          expoMessages.push(msgObj);
        } else {
          // Assume it's a native FCM token
          fcmTokens.push(token);
        }
      }
    }

    logDebug(`Parsed tokens - Expo messages: ${expoMessages.length}, Native FCM tokens: ${fcmTokens.length}`);

    // Send Expo Notifications
    if (expoMessages.length > 0) {
      let chunks = expo.chunkPushNotifications(expoMessages);
      let tickets = [];

      for (let chunk of chunks) {
        try {
          let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error('Error sending Expo push chunk:', error);
          logDebug(`Expo send error: ${error.message}`);
        }
      }

      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        const message = expoMessages[i];
        
        if (ticket.status === 'error') {
          console.error(`Error sending Expo notification to token ${message.to}:`, ticket.details);
          logDebug(`Expo ticket error for ${message.to}: ${JSON.stringify(ticket.details)}`);
          if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
            const merchant = tokenToMerchantMap[message.to];
            if (merchant) {
              merchant.pushTokens = merchant.pushTokens.filter(t => t !== message.to);
              await merchant.save();
            }
          }
        }
      }
    }

    // Send Native FCM Notifications using Firebase Admin SDK
    if (fcmTokens.length > 0) {
      logDebug(`Sending native FCM notifications to ${fcmTokens.length} tokens...`);
      const avatarUrl = options.android?.largeIcon || '';
      for (const token of fcmTokens) {
        const payload = {
          token: token,
          // Omit notification object to make it a data-only payload, ensuring
          // onMessageReceived triggers in the background to show the Reply button
          data: {
            title: title,
            body: body,
            avatarUrl: avatarUrl,
            ...Object.keys(data).reduce((acc, key) => {
              acc[key] = String(data[key]);
              return acc;
            }, {})
          },
          android: {
            priority: 'high'
          }
        };

        try {
          const response = await getMessaging().send(payload);
          console.log(`Successfully sent native FCM message: ${response}`);
          logDebug(`FCM success for token ${token.substring(0, 15)}...: ${response}`);
        } catch (error) {
          console.error(`Error sending native FCM to token ${token}:`, error);
          logDebug(`FCM error for token ${token.substring(0, 15)}...: ${error.message} (code: ${error.code})`);
          if (error.code === 'messaging/registration-token-not-registered') {
            // Clean up invalid/expired tokens
            const merchant = tokenToMerchantMap[token];
            if (merchant) {
              merchant.pushTokens = merchant.pushTokens.filter(t => t !== token);
              await merchant.save();
              console.log(`Cleaned up inactive native token ${token} for merchant ${merchant._id}`);
              logDebug(`Cleaned up inactive native token ${token.substring(0, 15)}...`);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error in sendPushNotifications helper:', err);
    logDebug(`Error in sendPushNotifications helper: ${err.message}`);
  }
};
