import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // Ensures each subscription is associated with a user
    },
    id: { type: String, required: true },
    status: { type: String, required: true },
    customer_id: { type: String },
    address_id: { type: String },
    subscription_id: { type: String },
    invoice_id: { type: String },
    invoice_number: { type: String },
    billing_details: { type: Object }, 
    currency_code: { type: String },
    billing_period: { type: String },
    items: { type: Array, default: [] }, 
    created_at: { type: Date},
    updated_at: { type: Date},
   
    
  },
 
);

export const Subscription = mongoose.model('Subscription', subscriptionSchema);
