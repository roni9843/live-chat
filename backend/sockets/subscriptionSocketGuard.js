const Merchant = require("../models/Merchant");
const {
  isSubscriptionActive,
  getSubscriptionFeatures,
} = require("../utils/subscription");

const socketFeatureGuard = (featureKey, handler) => {
  return async function guardedSocketHandler(payload = {}, callback) {
    try {
      const merchantId =
        this?.merchantId ||
        this?.user?._id ||
        payload?.merchantId ||
        payload?.senderId;

      if (!merchantId) {
        return callback?.({
          success: false,
          code: "AUTH_REQUIRED",
          message: "Merchant identity not found.",
        });
      }

      const merchant = await Merchant.findById(merchantId).select("subscription");

      if (!merchant || !isSubscriptionActive(merchant)) {
        return callback?.({
          success: false,
          code: "SUBSCRIPTION_REQUIRED",
          message: "Active subscription required.",
        });
      }

      const features = getSubscriptionFeatures(merchant);

      if (!features[featureKey]) {
        return callback?.({
          success: false,
          code: "FEATURE_NOT_INCLUDED",
          feature: featureKey,
          message: "Feature is not included in the current package.",
        });
      }

      return handler.call(this, payload, callback);
    } catch (error) {
      return callback?.({
        success: false,
        code: "SERVER_ERROR",
        message: error.message,
      });
    }
  };
};

module.exports = { socketFeatureGuard };

/*
Example inside chatSocket.js:

const { socketFeatureGuard } = require("./subscriptionSocketGuard");

socket.on(
  "call_request",
  socketFeatureGuard("canUseAudioCall", async function (payload, callback) {
    // your existing call_request code
  }).bind(socket)
);

socket.on(
  "video_call_request",
  socketFeatureGuard("canUseVideoCall", async function (payload, callback) {
    // your existing video call code
  }).bind(socket)
);
*/
