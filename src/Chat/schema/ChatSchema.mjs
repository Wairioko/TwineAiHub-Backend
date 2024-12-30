import mongoose from "mongoose";


// Problem Statement Schema
const ProblemStatementSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    registeredAuthor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: function() { return !this.anonymous; } },
    anonymousAuthor: { type: String, required: function() { return this.anonymous; } },  // For storing UUID when anonymous
    anonymous: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    attachedFile: {
      key: String,
      originalname: String,
      mimetype: String,
      size: Number
    },
  }
);


// Add method to get signed URL
ProblemStatementSchema.methods.getFileUrl = async function() {
  if (this.attachedFile?.key) {
      return await getSignedFileUrl(this.attachedFile.key);
  }
  return null;
};


// Assistant Breakdown Schema
const AssistantBreakdownSchema = new mongoose.Schema({
  chatGptId: { type: String},
  problemStatement: { type: mongoose.Schema.Types.ObjectId, ref: "ProblemStatement" },
  modelRoles: {},
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});


// Solve Problem Schema
const SolveProblemBreakdownSchema = new mongoose.Schema({
    problemStatement: { type: String, ref: "ProblemStatement" },
    relatedProblemStatement: {type: mongoose.Schema.Types.ObjectId, ref:"User"},
    modelRoles: {},
    // Add fields for both types of users
    registeredAuthor: { type: mongoose.Schema.Types.ObjectId, ref: "User"},
    anonymousAuthor: { type: String }, 
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
});


SolveProblemBreakdownSchema.methods.getFileUrl = async function() {
    if (this.attachedFile?.key) {
        return await getSignedFileUrl(this.attachedFile.key);
    }
    return null;
};


const ModelResponsesSchema = new mongoose.Schema({
  modelName: { type: String, required: true },
  role: { type: String },
  problemStatement: { type: mongoose.Schema.Types.ObjectId, ref: "ProblemStatement" }, // Add this if you need to reference problem statement
  responses: {
    response: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
});


const ChatSchema = new mongoose.Schema({
  // Add fields for both types of users
  registeredAuthor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  anonymousAuthor: { type: String },  // For UUID
  problemStatement: { type: mongoose.Schema.Types.ObjectId, ref: "ProblemStatement" }, 
  userProblemBreakdown: { type: mongoose.Schema.Types.ObjectId, ref: "SolveProblemBreakdown" }, 
  assistantProblemBreakdown: { type: mongoose.Schema.Types.ObjectId, ref: "AssistantBreakdown" },
  modelResponses: [{ type: mongoose.Schema.Types.ObjectId, ref: "ModelResponse" }], 
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});


export const SolveProblemBreakdownModel = mongoose.model('SolveProblemBreakdown', SolveProblemBreakdownSchema);
export const AssistantBreakdownModel = mongoose.model('AssistantBreakdown', AssistantBreakdownSchema);
export const ProblemStatementModel = mongoose.model('ProblemStatement', ProblemStatementSchema);
export const ModelResponse = mongoose.model('ModelResponse', ModelResponsesSchema);  
export const ChatModel = mongoose.model('Chat', ChatSchema);

