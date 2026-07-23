const express = require("express");
const router = express.Router();

const {
  getPublicPackages,
  getAdminPackages,
  createPackage,
  updatePackage,
  deletePackage,
  assignPackageToMerchant,
  cancelMerchantSubscription,
  getMySubscription,
  checkFeature,
  initializePayment,
  handleOraclePayWebhook,
  getPaymentHistory,
  getAdminPaymentHistory,
} = require("../controllers/subscriptionController");

const {
  protect,
  adminOnly,
} = require("../middleware/authMiddleware");

// Public package list
router.get("/packages", getPublicPackages);

// Admin package routes
router.get(
  "/admin/packages",
  protect,
  adminOnly,
  getAdminPackages
);

router.post(
  "/admin/packages",
  protect,
  adminOnly,
  createPackage
);

router.put(
  "/admin/packages/:id",
  protect,
  adminOnly,
  updatePackage
);

router.delete(
  "/admin/packages/:id",
  protect,
  adminOnly,
  deletePackage
);

// Assign package to merchant
router.post(
  "/admin/assign",
  protect,
  adminOnly,
  assignPackageToMerchant
);

// Cancel merchant subscription
router.patch(
  "/admin/merchant/:merchantId/cancel",
  protect,
  adminOnly,
  cancelMerchantSubscription
);

// Payment Integration
router.post("/initialize-payment", protect, initializePayment);
router.post("/webhook", handleOraclePayWebhook); // public webhook endpoint

// Payment History
router.get("/history", protect, getPaymentHistory);
router.get("/admin/history", protect, adminOnly, getAdminPaymentHistory);

// Merchant subscription
router.get("/me", protect, getMySubscription);

router.get(
  "/check/:feature",
  protect,
  checkFeature
);

module.exports = router;