import mongoose from "mongoose";

const UserSchema = mongoose.Schema({
    googleid:{
        type: String,

    },
    username: {
        type: String,
        required: true
    },
    email: {
        type:String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: false
    },
    subscriptionStatus: {
      type: String,
      default: "Free"
    },
    currentSubscription: {
      type: String,
    },
    cognitoSub:{
      type: String,
    },
    chats: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chat' }]

})


const userRequestSchema = new mongoose.Schema({
  userId: { type: String },
  requestCount: {
    type: Number,
    default: 0
  },
  lastRequest: {
    type: Date,
    default: Date.now
  },
  isAuthenticated: {
    type: Boolean,
    required: true
  }
});

// Adding an index on userId and isAuthenticated for faster lookups
userRequestSchema.index({ userId: 1, isAuthenticated: 1 });



export const UserRequest = mongoose.model('UserRequest', userRequestSchema);
export const UserModel = mongoose.model("User", UserSchema);

