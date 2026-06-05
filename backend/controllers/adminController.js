const Merchant = require('../models/Merchant');

// @desc    Get all users (merchants)
// @route   GET /api/admin/users
// @access  Private/SuperAdmin
exports.getAllUsers = async (req, res) => {
  try {
    const users = await Merchant.find({}).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update user
// @route   PUT /api/admin/users/:id
// @access  Private/SuperAdmin
exports.updateUser = async (req, res) => {
  try {
    const user = await Merchant.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    if (req.body.canCreateWidgets !== undefined) {
      user.canCreateWidgets = req.body.canCreateWidgets;
    }
    
    // We still allow updating role for super_admin
    if (req.body.role && ['super_admin', 'user'].includes(req.body.role)) {
      user.role = req.body.role;
    }

    const updatedUser = await user.save();
    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      canCreateWidgets: updatedUser.canCreateWidgets,
      role: updatedUser.role
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/SuperAdmin
exports.deleteUser = async (req, res) => {
  try {
    const user = await Merchant.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // You can't delete yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete yourself' });
    }

    await user.deleteOne();
    res.json({ message: 'User removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
