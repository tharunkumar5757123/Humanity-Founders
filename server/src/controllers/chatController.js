const { z } = require("zod");
const { processChatRequest } = require("../services/chatService");

const chatRequestSchema = z.object({
  userId: z.string().min(1),
  conversationId: z.string().optional(),
  patientName: z.string().optional(),
  disease: z.string().optional(),
  location: z.string().optional(),
  query: z.string().min(1),
});

function createChatController(env) {
  return async function handleChat(req, res) {
    try {
      const parsed = chatRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.message });
      }

      const response = await processChatRequest(env, parsed.data);
      return res.json(response);
    } catch (error) {
      console.error("POST /api/chat failed", error);

      const message = error?.message || "Unexpected server error";
      const status = /Ollama|fetch failed|ECONNREFUSED/i.test(message) ? 503 : 500;
      return res.status(status).json({ error: message });
    }
  };
}

module.exports = { createChatController };
