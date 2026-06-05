const jwt = require('jsonwebtoken');
const Merchant = require('../models/Merchant');
const Admin = require('../models/Admin');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_super_secret_jwt_key_here');

      if (decoded.role === 'merchant') {
        req.user = await Merchant.findById(decoded.id).select('-password');
        // We do NOT overwrite req.user.role because Merchant schema has its own role field (super_admin, admin, agent)
      } else if (decoded.role === 'admin') {
        req.user = await Admin.findById(decoded.id).select('-password');
        // For backwards compatibility if Admin schema relies on it
        req.user.role = decoded.role;
      }

      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(401).json({ message: 'Not authorized as an admin' });
  }
};

module.exports = { protect, admin };
