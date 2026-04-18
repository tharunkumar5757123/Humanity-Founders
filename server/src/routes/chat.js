const express = require("express");
const { createChatController } = require("../controllers/chatController");

function chatRouter(env) {
  const router = express.Router();
  router.post("/", createChatController(env));
  return router;
}

module.exports = { chatRouter };
