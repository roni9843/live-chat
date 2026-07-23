const Merchant = require('../models/Merchant');
const { sendPushNotifications } = require('./pushNotifications');

const checkSubscriptions = async () => {
  console.log('[Subscription Cron] Checking for expired or expiring subscriptions...');
  const now = new Date();
  
  try {
    // 1. Process Expired Subscriptions
    const expiredMerchants = await Merchant.find({
      'subscription.status': 'active',
      'subscription.expiresAt': { $lte: now }
    });

    for (const merchant of expiredMerchants) {
      console.log(`[Subscription Cron] Expiring subscription for merchant ${merchant.name} (${merchant._id})`);
      merchant.subscription.status = 'expired';
      merchant.canCreateWidgets = false;
      await merchant.save();

      // Trigger push notification for expiration
      try {
        await sendPushNotifications(
          [merchant._id.toString()],
          "Subscription Expired",
          "Your Ochat subscription has expired. All widgets are now disabled. Please renew your package.",
          { screen: "subscription" }
        );
      } catch (err) {
        console.error(`Failed to send push notification to expired merchant ${merchant._id}:`, err);
      }
    }

    // 2. Process Expiring Subscriptions (expires in <= 7 days)
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const warningThreshold = new Date(Date.now() - 23 * 60 * 60 * 1000); // 23 hours ago
    
    const expiringMerchants = await Merchant.find({
      'subscription.status': 'active',
      'subscription.expiresAt': { $gt: now, $lte: sevenDaysFromNow },
      $or: [
        { 'subscription.expiryWarningSentAt': { $exists: false } },
        { 'subscription.expiryWarningSentAt': { $lte: warningThreshold } },
        { 'subscription.expiryWarningSentAt': null }
      ]
    });

    for (const merchant of expiringMerchants) {
      const diffMs = new Date(merchant.subscription.expiresAt).getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      
      console.log(`[Subscription Cron] Sending renewal warning to merchant ${merchant.name} and agents. Expires in ${diffDays} days.`);
      
      merchant.subscription.expiryWarningSentAt = now;
      await merchant.save();

      // Gather owner and all agents/admins
      const recipientIds = new Set();
      recipientIds.add(merchant._id.toString());
      if (merchant.widgets && merchant.widgets.length > 0) {
        for (const widget of merchant.widgets) {
          if (widget.authorizedUsers && widget.authorizedUsers.length > 0) {
            for (const authUser of widget.authorizedUsers) {
              if (authUser.user) {
                recipientIds.add(authUser.user.toString());
              }
            }
          }
        }
      }

      try {
        await sendPushNotifications(
          Array.from(recipientIds),
          "Subscription Renewal Reminder",
          `O-Chat subscription for "${merchant.subscription.packageName}" (Merchant: ${merchant.name}) will expire in ${diffDays} days. Please renew to prevent service interruptions.`,
          { screen: "subscription" }
        );
      } catch (err) {
        console.error(`Failed to send push notification to expiring merchant/agents for ${merchant._id}:`, err);
      }
    }
  } catch (err) {
    console.error('[Subscription Cron] Error checking subscriptions:', err);
  }
};

const startSubscriptionCron = () => {
  // Run immediately on startup
  checkSubscriptions();
  
  // Run every 12 hours
  setInterval(checkSubscriptions, 12 * 60 * 60 * 1000);
};

module.exports = { startSubscriptionCron };
