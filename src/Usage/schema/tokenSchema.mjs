import mongoose from 'mongoose';

// First define the tokenUsageSchema
const tokenUsageSchema = new mongoose.Schema({
  promptTokens: {
    type: Number,
    required: true,
    default: 0
  },
  completionTokens: {
    type: Number,
    required: true,
    default: 0
  },
  totalTokens: {
    type: Number,
    required: true,
    default: 0
  },
  cost: {
    type: Number,
    required: true,
    default: 0
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Then define the userBillingSchema
const userBillingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  anonymousUser: { 
    type: String, 
    required: true 
  },
  tokenUsage: [tokenUsageSchema], // Array of token usage entries
  subscriptionType: { 
    type: String, 
    enum: ['weekly', 'monthly_basic', 'monthly_premium'], 
    required: true 
  },
  creditBalance: { 
    type: Number, 
    default: 0 
  },  
  carriedForwardCredit: { 
    type: Number, 
    default: 0 
  }, 
  monthlyUsage: { 
    type: Number, 
    default: 0 
  }, 
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // Automatically manage createdAt and updatedAt fields
});

// Create and export the model
export const UserBillingModel = mongoose.model('UserBilling', userBillingSchema);

