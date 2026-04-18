const express = require("express");
const { z } = require("zod");
const { ConversationModel } = require("../models/Conversation");

const conversationsRouter = express.Router();

const createSchema = z.object({
  userId: z.string().min(1),
  patientName: z.string().optional(),
  disease: z.string().optional(),
  location: z.string().optional(),
});

conversationsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }

  const conversation = await ConversationModel.create({
    userId: parsed.data.userId,
    patientName: parsed.data.patientName,
    disease: parsed.data.disease,
    location: parsed.data.location,
    messages: [],
  });

  return res.json({ conversationId: String(conversation._id) });
});

conversationsRouter.get("/:id", async (req, res) => {
  const { id } = req.params;
  const userId = String(req.query.userId || "");
  if (!userId) return res.status(400).json({ error: "userId is required" });

  const conversation = await ConversationModel.findOne({ _id: id, userId });
  if (!conversation) return res.status(404).json({ error: "Not found" });

  return res.json({
    conversationId: String(conversation._id),
    patientName: conversation.patientName,
    disease: conversation.disease,
    location: conversation.location,
    messages: conversation.messages,
  });
});

module.exports = { conversationsRouter };

