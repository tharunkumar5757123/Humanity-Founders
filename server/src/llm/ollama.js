const { z } = require("zod");
const { fetchWithTimeout } = require("../http");

const llmResponseSchema = z.object({
  condition_overview: z.string(),
  first_line_treatments: z.array(z.string()).default([]),
  comparison_table: z
    .array(
      z.object({
        treatment: z.string(),
        mechanism: z.string().optional(),
        effectiveness: z.string().optional(),
        when_used: z.string().optional(),
        limitations: z.string().optional(),
      })
    )
    .default([]),
  research_insights: z
    .array(
      z.object({
        claim: z.string(),
        evidence: z.array(z.string()).default([]),
        notes: z.string().optional(),
      })
    )
    .default([]),
  clinical_trials: z
    .array(
      z.object({
        trial_id: z.string(),
        why_relevant: z.string(),
        status: z.string().optional(),
      })
    )
    .default([]),
  personalized_takeaways: z.array(z.string()).default([]),
  follow_up_questions: z.array(z.string()).default([]),
  limitations: z.string().optional(),
});

function firstSnippet(text, max = 280) {
  if (!text) return undefined;
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  return clean.length > max ? `${clean.slice(0, max - 1)}...` : clean;
}

function isGreeting(text) {
  const normalized = text.trim().toLowerCase();
  return [
    "hi",
    "hello",
    "hey",
    "good morning",
    "good afternoon",
    "good evening",
  ].includes(normalized);
}

function safeJsonParse(text) {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return { ok: false, error: "No JSON object found" };
  }

  const slice = trimmed.slice(start, end + 1);
  try {
    return { ok: true, value: JSON.parse(slice) };
  } catch (error) {
    return { ok: false, error: error?.message || "Invalid JSON" };
  }
}

function isComparisonQuery(text) {
  return /\b(compare|comparison|versus|vs)\b/i.test(text || "");
}

function buildEvidencePacks(opts) {
  const pubTop = opts.publications.slice(0, 5).map((publication, index) => ({
    ref: `S${index + 1}`,
    title: publication.title,
    year: publication.year,
    authors: publication.authors.slice(0, 3).join(", "),
    source: publication.sources?.join(" + ") || publication.source,
    url: publication.url,
    snippet: firstSnippet(publication.abstract, 160),
  }));

  const trialTop = opts.trials.slice(0, 3).map((trial, index) => ({
    ref: `T${index + 1}`,
    nctId: trial.id,
    title: trial.title,
    status: trial.status,
    url: trial.url,
    location: trial.locations[0],
    eligibility: firstSnippet(trial.eligibility, 180),
    contact: trial.contacts[0],
  }));

  return { pubTop, trialTop };
}

function buildContext(pubTop, trialTop) {
  const paperContext = pubTop
    .map(
      (paper, index) => `[${index + 1}]
Title: ${paper.title}
Year: ${paper.year || "Unknown"}
Authors: ${paper.authors || "Unknown"}
Source: ${paper.source}
Summary: ${paper.snippet || "No abstract available"}`
    )
    .join("\n\n");

  const trialContext = trialTop
    .map(
      (trial, index) => `[T${index + 1}]
Title: ${trial.title}
Status: ${trial.status || "Unknown"}
Location: ${trial.location || "Unknown"}
Summary: ${trial.eligibility || "No eligibility summary available"}`
    )
    .join("\n\n");

  return { paperContext, trialContext };
}

function buildStructuredPrompt(opts, pubTop, trialTop) {
  const comparisonMode = isComparisonQuery(opts.userQuery);
  const analysisGoal = comparisonMode
    ? "This is a treatment comparison request. Explicitly compare the leading options, tradeoffs, and relative evidence strength."
    : "Summarize the main clinical and research insights as clearly as possible.";
  const { paperContext, trialContext } = buildContext(pubTop, trialTop);

  const system = `You are a medical research assistant.

STRICT RULES:
- Use ONLY the provided research data.
- Do NOT hallucinate or invent citations.
- If evidence is missing or weak, say "No strong evidence found" instead of guessing.
- Prioritize recent studies, especially within the last 5 years when the evidence supports that.
- Focus ONLY on the given disease and query.
- Be specific, clinical, and concise.
- If the user asks to compare, provide a real comparison instead of just listing papers.
- Keep practical takeaways substantive, not administrative.
- Mention uncertainty or evidence gaps when the supplied evidence is limited.
- This is research support, not medical advice.

Return STRICT JSON with exactly these keys:
- condition_overview
- first_line_treatments[]
- comparison_table[{treatment,mechanism,effectiveness,when_used,limitations}]
- research_insights[{claim,evidence,notes?}]
- clinical_trials[{trial_id,why_relevant,status?}]
- personalized_takeaways[]
- follow_up_questions[]
- limitations?

Interpret the sections this way:
- condition_overview: 2-4 sentences summarizing the condition/question and the direction of the evidence. Do not say "I gathered research" or use process language.
- first_line_treatments: for comparison/treatment queries, list the main first-line options only.
- comparison_table: for comparison queries, return a side-by-side comparison with treatment, mechanism, effectiveness, when_used, and limitations.
- research_insights: 3-5 specific points. For comparison queries, make these comparative. Do not just restate paper titles.
- clinical_trials: include only trials from the supplied evidence, and make each why_relevant field describe the trial focus or target population in plain language.
- personalized_takeaways: 2-4 practical, evidence-grounded takeaways for this query.
- follow_up_questions: 2 concise next-step questions.`;

  const userPayload = {
    disease: opts.disease,
    query: opts.userQuery,
    analysis_goal: analysisGoal,
    patient: {
      name: opts.patientName,
      location: opts.location,
    },
    conversation_context: opts.conversationContext.slice(-6),
    research: pubTop,
    trials: trialTop,
    source_attribution_format: {
      title: "paper title",
      authors: "author list",
      year: "publication year",
      source: "PubMed or OpenAlex",
    },
    context: paperContext,
    trial_context: trialContext,
    output_format: [
      "1. Condition Overview",
      "2. First-line treatments",
      comparisonMode ? "3. Comparison table" : "3. Key Research Insights",
      "4. Key Research Insights",
      "5. Clinical Trials",
      "6. Practical Takeaways",
    ],
    instruction:
      "Use only the supplied evidence to answer clearly. If the query is comparative, return a real side-by-side comparison table and do not give a generic explanation. If the supplied evidence is not strong enough, explicitly say no strong evidence was found.",
  };

  const flatPrompt = `You are a medical research assistant.

STRICT RULES:
- Use ONLY the provided research data.
- Do NOT hallucinate or invent citations.
- If evidence is weak, say "No strong evidence found".
- Focus ONLY on ${opts.disease || "the requested condition"}.

QUESTION:
${opts.userQuery}

CONTEXT:
${paperContext}

CLINICAL TRIALS:
${trialContext}

Return STRICT JSON with keys:
condition_overview, first_line_treatments, comparison_table, research_insights, clinical_trials, personalized_takeaways, follow_up_questions, limitations

For comparison queries, the comparison_table must include:
- treatment
- mechanism
- effectiveness
- when_used
- limitations`;

  return { system, userPayload, flatPrompt };
}

function greetingResponse() {
  return {
    ok: true,
    data: {
      condition_overview:
        "Hello. I'm ready to help you review medical research, clinical trials, and recent evidence.",
      research_insights: [],
      clinical_trials: [],
      personalized_takeaways: [
        "Tell me the condition, treatment, or question you want to explore.",
      ],
      follow_up_questions: [
        "What disease, treatment, or symptom would you like to research?",
      ],
      limitations:
        "This assistant summarizes research evidence and should not replace advice from a clinician.",
    },
    raw: "",
    pubTop: [],
    trialTop: [],
  };
}

async function runViaOllama(opts, system, userPayload) {
  const url = new URL("/api/chat", opts.ollamaHost);
  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: opts.model,
        stream: false,
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
        options: { temperature: 0.15, num_predict: 260 },
      }),
    },
    opts.timeoutMs ?? 60000
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Ollama error ${response.status}: ${body}`);
  }

  const json = await response.json();
  return json.message?.content || "";
}

async function runViaHuggingFace(opts, prompt) {
  if (!opts.hfApiKey) {
    throw new Error("HF_API_KEY is required when LLM_PROVIDER=huggingface");
  }

  const url = new URL(`https://api-inference.huggingface.co/models/${opts.hfModel}`);
  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${opts.hfApiKey}`,
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 320,
          temperature: 0.2,
          return_full_text: false,
        },
      }),
    },
    opts.hfTimeoutMs ?? 30000
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Hugging Face error ${response.status}: ${body}`);
  }

  const json = await response.json();
  if (Array.isArray(json) && json[0]?.generated_text) {
    return json[0].generated_text;
  }
  if (typeof json?.generated_text === "string") {
    return json.generated_text;
  }
  throw new Error("Hugging Face returned an unexpected response format");
}

async function runOllamaReasoning(opts) {
  if (isGreeting(opts.userQuery)) {
    return greetingResponse();
  }

  const { pubTop, trialTop } = buildEvidencePacks(opts);
  const { system, userPayload, flatPrompt } = buildStructuredPrompt(opts, pubTop, trialTop);

  const content =
    opts.provider === "huggingface"
      ? await runViaHuggingFace(opts, flatPrompt)
      : await runViaOllama(opts, system, userPayload);

  const parsed = safeJsonParse(content);
  if (!parsed.ok) {
    return { ok: false, raw: content, error: parsed.error };
  }

  const validated = llmResponseSchema.safeParse(parsed.value);
  if (!validated.success) {
    return { ok: false, raw: content, error: validated.error.message };
  }

  return {
    ok: true,
    data: validated.data,
    raw: content,
    pubTop,
    trialTop,
  };
}

module.exports = { runOllamaReasoning };
