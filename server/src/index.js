require("dotenv/config");

const express = require("express");
const cors = require("cors");
const { loadEnv } = require("./env");
const { connectMongo } = require("./db");
const { chatRouter } = require("./routes/chat");
const { conversationsRouter } = require("./routes/conversations");

async function main() {
  const env = loadEnv();
  await connectMongo(env.MONGO_URI);

  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/conversations", conversationsRouter);
  app.use("/api/chat", chatRouter(env));

  app.listen(env.PORT, () => {
    console.log(`Curalink server listening on :${env.PORT}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
