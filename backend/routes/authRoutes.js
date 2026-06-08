const express = require('express');
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
  respondToInvite
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/merchant/register', registerMerchant);
router.post('/merchant/login', loginMerchant);

router.route('/merchant/profile')
  .get(protect, getMerchantProfile)
  .put(protect, updateMerchantProfile);

router.get('/merchant/search', protect, searchMerchants);

router.put('/merchant/password', protect, changeMerchantPassword);

// Widget management routes (Protected)
router.post('/merchant/widgets', protect, addWidget);
router.route('/merchant/widgets/:widgetId')
  .put(protect, updateWidget)
  .delete(protect, deleteWidget);

router.post('/merchant/widgets/:widgetId/invite', protect, inviteUserToWidget);
router.get('/merchant/invites', protect, getPendingInvites);
router.post('/merchant/invites/:widgetId/respond', protect, respondToInvite);

// Public Widget Route
router.get('/widgets/:widgetId', getWidgetPublic);
router.post('/widgets/:widgetId/offline-message', postOfflineMessage);

router.post('/admin/login', loginAdmin);

module.exports = router;
