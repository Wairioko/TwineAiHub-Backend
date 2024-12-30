import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  paddleSubscriptionId: {
    type: String,
    required: true,
    unique: true
  },
  planId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'past_due', 'paused', 'expired'],
    default: 'active'
  },
  currentPeriodStart: {
    type: Date,
    required: true
  },
  currentPeriodEnd: {
    type: Date,
    required: true
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  paymentMethod: {
    type: String
  },
  lastPaymentDate: Date,
  nextBillAmount: Number,
  nextBillDate: Date,
  pausedAt: Date,
  cancelledAt: Date,
  updateUrl: String,
  cancelUrl: String
}, {
  timestamps: true
});

// Add indexes for common queries
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ currentPeriodEnd: 1 });

export const Subscription = mongoose.model('Subscription', subscriptionSchema);
