const express = require('express');
const router = express.Router();
const { getAllUsers, updateUser, deleteUser } = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');

// Middleware to check for super_admin role
const superAdminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'super_admin') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as super admin' });
  }
};

router.route('/users')
  .get(protect, superAdminOnly, getAllUsers);

router.route('/users/:id')
  .put(protect, superAdminOnly, updateUser)
  .delete(protect, superAdminOnly, deleteUser);

module.exports = router;
