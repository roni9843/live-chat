const express = require("express");
const router = express.Router();

const {
  registerMerchant,
  loginMerchant,
  loginAdmin,
  getMerchantProfile,
  updateMerchantProfile,
  changeMerchantPassword,
  addWidget,
  updateWidget,
  deleteWidget,
  getWidgetPublic,
  postOfflineMessage,
  searchMerchants,
  inviteUserToWidget,
  getPendingInvites,
  respondToInvite,
  startDirectMessage,
  createGroupChat,
  leaveGroupChat,
  updateGroupSettings,
  updateGroupMember,
  kickGroupMember,
  savePushToken,
  removePushToken,
  sendRESTMessage,
  getMerchantSessions,
  getSessionMessages,
} = require("../controllers/authController");

const {
  protect,
  requireFeature,
} = require("../middleware/authMiddleware");

router.post("/merchant/register", registerMerchant);
router.post("/merchant/login", loginMerchant);
router.post("/admin/login", loginAdmin);

router.get("/merchant/profile", protect, getMerchantProfile);
router.put("/merchant/profile", protect, updateMerchantProfile);
router.put("/merchant/password", protect, changeMerchantPassword);

router.post("/merchant/push-token", protect, savePushToken);
router.post("/merchant/push-token/remove", protect, removePushToken);
router.post("/merchant/message", protect, sendRESTMessage);

router.get("/merchant/search", protect, searchMerchants);

router.post(
  "/merchant/direct-message",
  protect,
  requireFeature("canUseDirectMessage"),
  startDirectMessage
);

router.post(
  "/merchant/group-chat",
  protect,
  requireFeature("canUseGroupChat"),
  createGroupChat
);

router.post(
  "/merchant/group-chat/:sessionId/leave",
  protect,
  requireFeature("canUseGroupChat"),
  leaveGroupChat
);

router.put(
  "/merchant/group-chat/:sessionId/settings",
  protect,
  requireFeature("canUseGroupChat"),
  updateGroupSettings
);

router.put(
  "/merchant/group-chat/:sessionId/member",
  protect,
  requireFeature("canUseGroupChat"),
  updateGroupMember
);

router.post(
  "/merchant/group-chat/:sessionId/kick",
  protect,
  requireFeature("canUseGroupChat"),
  kickGroupMember
);

router.get("/merchant/sessions", protect, getMerchantSessions);
router.get(
  "/merchant/sessions/:sessionId/messages",
  protect,
  getSessionMessages
);

router.post(
  "/merchant/widgets",
  protect,
  requireFeature("canCreateWidgets"),
  addWidget
);

router.put("/merchant/widgets/:widgetId", protect, updateWidget);
router.delete("/merchant/widgets/:widgetId", protect, deleteWidget);

router.post(
  "/merchant/widgets/:widgetId/invite",
  protect,
  requireFeature("canAddAgents"),
  inviteUserToWidget
);

router.get("/merchant/invites", protect, getPendingInvites);
router.post(
  "/merchant/invites/:widgetId/respond",
  protect,
  respondToInvite
);

router.get("/widgets/:widgetId", getWidgetPublic);
router.post(
  "/widgets/:widgetId/offline-message",
  postOfflineMessage
);

module.exports = router;
