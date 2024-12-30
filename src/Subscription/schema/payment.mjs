import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription'
    },
    paddlePaymentId: {
      type: String,
      required: true,
      unique: true
    },
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['completed', 'refunded', 'failed'],
      required: true
    },
    paymentMethod: String,
    receiptUrl: String,
    refundReason: String,
    paidAt: Date
  }, {
    timestamps: true
  });
  

export const Payment = mongoose.model('Payment', paymentSchema);

