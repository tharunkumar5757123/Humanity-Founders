const mongoose = require("mongoose");

const { Schema } = mongoose;

const evidenceRefSchema = new Schema(
  {
    id: { type: String, required: true },
    kind: { type: String, required: true, enum: ["publication", "trial"] },
    title: { type: String, required: true },
    year: { type: Number, required: false },
    authors: { type: [String], required: false },
    source: { type: String, required: false },
    url: { type: String, required: false },
    snippet: { type: String, required: false },
  },
  { _id: false }
);

const chatMessageSchema = new Schema(
  {
    role: { type: String, required: true, enum: ["user", "assistant", "system"] },
    content: { type: String, required: true },
    createdAt: { type: Date, required: true, default: () => new Date() },
    evidence: { type: [evidenceRefSchema], required: false, default: undefined },
  },
  { _id: false }
);

const conversationSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    patientName: { type: String, required: false },
    disease: { type: String, required: false },
    location: { type: String, required: false },
    messages: { type: [chatMessageSchema], required: true, default: [] },
  },
  { timestamps: true }
);

const ConversationModel =
  mongoose.models.Conversation ||
  mongoose.model("Conversation", conversationSchema);

module.exports = { ConversationModel };

