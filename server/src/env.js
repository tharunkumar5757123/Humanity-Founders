const { z } = require("zod");

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  MONGO_URI: z.string().min(1),
  OLLAMA_HOST: z.string().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().default("llama3"),
  OLLAMA_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  LLM_PROVIDER: z.enum(["ollama", "huggingface"]).default("ollama"),
  HF_API_KEY: z.string().optional(),
  HF_MODEL: z.string().default("mistralai/Mistral-7B-Instruct-v0.2"),
  HF_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  CHAT_CACHE_TTL_MS: z.coerce.number().int().positive().default(120000),
  CHAT_CANDIDATES_MAX: z.coerce.number().int().positive().default(60),
  CHAT_FAST_MODE: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((value) => value === "true"),
  CHAT_DEBUG_LLM_ONLY: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((value) => value === "true"),
  OPENALEX_MAILTO: z.string().email().optional(),
  PUBMED_TOOL: z.string().default("curalink-hackathon"),
  PUBMED_EMAIL: z.string().email().optional(),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment:\n${message}`);
  }

  return parsed.data;
}

module.exports = { loadEnv };
