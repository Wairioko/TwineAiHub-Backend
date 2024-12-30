import mongoose from "mongoose";



const userCreditSchema =  new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    balance: {
        type: Number,
        default: 0
    },
    lastUpdated:{
        type: Date,
        default: Date.now
    }
})


export const userCreditModel = mongoose.model('UserCredit', userCreditSchema);


