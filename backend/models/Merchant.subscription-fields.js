// Add these fields inside your existing Merchant schema root object.

subscription: {
  package: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SubscriptionPackage",
    default: null,
  },
  packageName: {
    type: String,
    default: "",
  },
  status: {
    type: String,
    enum: ["none", "active", "expired", "cancelled"],
    default: "none",
    index: true,
  },
  startedAt: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    default: null,
    index: true,
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    default: null,
  },
  price: {
    type: Number,
    default: 0,
  },
  currency: {
    type: String,
    default: "BDT",
  },
  featuresSnapshot: {
    canCreateWidgets: { type: Boolean, default: false },
    maxWidgets: { type: Number, default: 0 },

    canAddAgents: { type: Boolean, default: false },
    maxAgentsPerWidget: { type: Number, default: 0 },

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

    chatHistoryDays: { type: Number, default: 30 },
  },
},
