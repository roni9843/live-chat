const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  merchant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: true,
    index: true
  },
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  packageName: {
    type: String,
    required: true
  },
  packageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPackage',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'BDT'
  },
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
    default: 'PENDING',
    index: true
  },
  transactionId: {
    type: String,
    default: ''
  },
  bank: {
    type: String,
    default: ''
  },
  sessionCode: {
    type: String,
    default: ''
  },
  durationValue: {
    type: Number,
    required: true
  },
  durationUnit: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Payment', paymentSchema);
