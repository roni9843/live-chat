const mongoose = require("mongoose");

const packageFeaturesSchema = new mongoose.Schema(
  {
    canCreateWidgets: { type: Boolean, default: false },
    maxWidgets: { type: Number, default: 0, min: 0 },

    canAddAgents: { type: Boolean, default: false },
    maxAgentsPerWidget: { type: Number, default: 0, min: 0 },

    canUseAudioCall: { type: Boolean, default: false },
    canUseVideoCall: { type: Boolean, default: false },
    canUseVoiceMessage: { type: Boolean, default: false },
    canUploadFiles: { type: Boolean, default: false },

    canUseDirectMessage: { type: Boolean, default: false },
    canUseGroupChat: { type: Boolean, default: false },

    canUseFaq: { type: Boolean, default: false },
    canUsePreChatForm: { type: Boolean, default: false },
    canUseOfflineForm: { type: Boolean, default: false },
    canCustomizeWidget: { type: Boolean, default: false },
    canUseLiveTracking: { type: Boolean, default: false },

    chatHistoryDays: { type: Number, default: 30, min: 0 },
  },
  { _id: false }
);

const subscriptionPackageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      enum: ["BDT"],
      default: "BDT",
    },
    durationValue: {
      type: Number,
      required: true,
      min: 1,
    },
    durationUnit: {
      type: String,
      enum: ["month", "year"],
      default: "month",
    },
    features: {
      type: packageFeaturesSchema,
      default: () => ({}),
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },
  },
  { timestamps: true }
);

subscriptionPackageSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model("SubscriptionPackage", subscriptionPackageSchema);
