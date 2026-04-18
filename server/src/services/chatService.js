const { ConversationModel } = require("../models/Conversation");
const { retrieveAll } = require("../retrieval");
const { runOllamaReasoning } = require("../llm/ollama");
const { resolveDiseaseContext } = require("../retrieval/query");
const {
  detectIntent,
  shouldReuseConversationContext,
  buildCacheKey,
} = require("./queryIntelligence");
const { TtlCache } = require("../utils/cache");

const responseCache = new TtlCache(120000);

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

function isComparisonQuery(text) {
  return /\b(compare|comparison|versus|vs)\b/i.test(text || "");
}

function firstSentence(text) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  const match = clean.match(/(.+?[.!?])(\s|$)/);
  return (match ? match[1] : clean).trim();
}

function sentenceCase(text) {
  if (!text) return undefined;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function buildConditionOverview(disease, query, publications, trials) {
  const normalizedDisease = (disease || "the condition").trim();
  const lowerDisease = normalizedDisease.toLowerCase();
  const comparisonMode = isComparisonQuery(query);

  if (lowerDisease.includes("alzheimer")) {
    return `Alzheimer's disease is a progressive neurodegenerative disorder marked by cognitive decline and memory loss. The retrieved evidence emphasizes early detection, biomarker-guided diagnosis, and disease-modifying trial strategies${trials.length ? " with active clinical studies focused on targeted enrollment" : ""}.`;
  }

  if (lowerDisease.includes("rheumatoid arthritis")) {
    return comparisonMode
      ? "Rheumatoid arthritis is a chronic autoimmune inflammatory disease in which first-line treatment aims to control symptoms early and prevent joint damage. The retrieved evidence centers on how standard disease-modifying therapy compares with newer escalation options when baseline control is not adequate."
      : "Rheumatoid arthritis is a chronic autoimmune inflammatory disease that requires early control to reduce symptoms and long-term joint damage. The retrieved evidence focuses on treatment effectiveness, sequencing, and ongoing trial activity.";
  }

  if (comparisonMode) {
    return `${normalizedDisease} is the focus of this treatment-comparison query. The top evidence emphasizes comparative effectiveness, treatment sequencing, and the balance between standard first-line approaches and escalation strategies.`;
  }

  const publicationHint = publications[0]?.abstract
    ? firstSentence(publications[0].abstract)
    : undefined;

  return publicationHint
    ? `${sentenceCase(normalizedDisease)} is the focus of this query. Current evidence highlights ${publicationHint.charAt(0).toLowerCase() + publicationHint.slice(1)}`
    : `${sentenceCase(normalizedDisease)} is the focus of this query. The retrieved evidence emphasizes current research findings, treatment direction, and relevant clinical trial activity.`;
}

function extractTreatmentCandidates(publications) {
  const keywords = [
    "methotrexate",
    "leflunomide",
    "sulfasalazine",
    "hydroxychloroquine",
    "biologics",
    "biologic",
    "jak inhibitors",
    "jak inhibitor",
    "tofacitinib",
    "adalimumab",
    "etanercept",
  ];

  const text = publications
    .map((publication) => `${publication.title || ""} ${publication.abstract || ""}`.toLowerCase())
    .join(" ");

  return keywords.filter((keyword, index, array) => text.includes(keyword) && array.indexOf(keyword) === index);
}

function buildComparisonTable(publications) {
  const treatments = extractTreatmentCandidates(publications);
  return treatments.slice(0, 4).map((treatment) => {
    if (treatment.includes("methotrexate")) {
      return {
        treatment: "Methotrexate",
        mechanism: "Conventional DMARD with antifolate activity",
        effectiveness: "Strong anchor first-line option",
        when_used: "Typical starting therapy for newly diagnosed inflammatory disease",
        limitations: "Monitoring needed for liver, blood count, and tolerability issues",
      };
    }

    if (treatment.includes("biologic")) {
      return {
        treatment: "Biologics",
        mechanism: "Targeted immune pathway inhibition",
        effectiveness: "Useful when baseline control is inadequate",
        when_used: "Usually after inadequate response to conventional first-line therapy",
        limitations: "Higher cost and infection risk considerations",
      };
    }

    if (treatment.includes("jak")) {
      return {
        treatment: "JAK inhibitors",
        mechanism: "Oral intracellular signaling inhibition",
        effectiveness: "Moderate to high efficacy in escalation settings",
        when_used: "Often considered after conventional therapy failure or intolerance",
        limitations: "Safety monitoring and infection risk remain important",
      };
    }

    return {
      treatment: sentenceCase(treatment),
      mechanism: "Reported in the retrieved evidence",
      effectiveness: "Supported by retrieved comparative literature",
      when_used: "Use depends on disease stage and prior response",
      limitations: "Review source evidence for specific safety and sequencing details",
    };
  });
}

function buildResearchInsights(publications) {
  const seen = new Set();
  const insights = [];

  for (const publication of publications) {
    const abstractLead = firstSentence(publication.abstract);
    const claimBase = abstractLead || publication.title;
    if (!claimBase) continue;

    const normalized = claimBase.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    insights.push({
      claim: sentenceCase(claimBase.replace(/\.$/, "")),
      evidence: [publication.source],
      notes: publication.year
        ? `${publication.source}, ${publication.year}${publication.authors?.length ? `, ${publication.authors.slice(0, 2).join(", ")}` : ""}`
        : publication.source,
    });

    if (insights.length === 4) break;
  }

  return insights;
}

function trialFocus(trial) {
  const eligibility = firstSentence(trial.eligibility);
  if (eligibility) return eligibility.replace(/\.$/, "");
  return "Study eligibility and design focus are available in the linked trial record";
}

function buildTrialReason(trial) {
  const parts = [trial.title];
  if (trial.locations?.[0]) parts.push(`Location: ${trial.locations[0]}`);
  parts.push(`Focus: ${trialFocus(trial)}`);
  return parts.join(" | ");
}

function buildTakeaways(query, disease, publications, trials) {
  const takeaways = [];
  const comparisonMode = isComparisonQuery(query);
  const lowerDisease = (disease || "").toLowerCase();

  if (lowerDisease.includes("alzheimer")) {
    takeaways.push("Most current studies emphasize earlier detection, biomarker use, and identifying high-risk populations before advanced decline.");
    if (trials.length > 0) {
      takeaways.push("Trial eligibility often centers on mild cognitive impairment, early-stage disease, or biomarker-defined risk groups.");
    }
  }

  if (lowerDisease.includes("rheumatoid arthritis") && comparisonMode) {
    takeaways.push("Methotrexate remains the usual anchor for first-line rheumatoid arthritis treatment in comparative evidence sets.");
    takeaways.push("Biologics and other targeted therapies become more relevant when baseline disease control is inadequate or escalation is needed.");
  }

  if (takeaways.length === 0 && publications.length > 0) {
    takeaways.push("The strongest practical points come from the highest-ranked recent studies rather than a broad unscreened literature list.");
  }

  if (trials.length > 0) {
    takeaways.push("Active clinical trials provide the clearest view of where treatment development and patient selection are moving next.");
  }

  if (publications.length > 1) {
    takeaways.push("The evidence rail is most useful for checking whether the top sources agree on direction, target population, and treatment focus.");
  }

  return takeaways.slice(0, 4);
}

function buildFallbackResponse(body, conversation, retrieval, error) {
  const publications = retrieval.publications.slice(0, 3);
  const trials = retrieval.trials.slice(0, 2);
  const limitation = error?.message || "Ollama was unavailable or timed out.";
  const disease = conversation.disease || "the condition";

  return {
    condition_overview: buildConditionOverview(disease, body.query, publications, trials),
    first_line_treatments: extractTreatmentCandidates(publications)
      .slice(0, 4)
      .map((item) => sentenceCase(item)),
    comparison_table: isComparisonQuery(body.query) ? buildComparisonTable(publications) : [],
    research_insights: buildResearchInsights(publications),
    clinical_trials: trials.map((trial) => ({
      trial_id: trial.id,
      why_relevant: buildTrialReason(trial),
      status: trial.status,
    })),
    personalized_takeaways: buildTakeaways(body.query, disease, publications, trials),
    follow_up_questions: [
      isComparisonQuery(body.query)
        ? "Would you like a stricter comparison of first-line versus escalation therapies?"
        : "Would you like a shorter clinical summary or a source-by-source breakdown?",
      "Should I focus next on guidelines, publications, or clinical trials?",
    ],
    limitations: limitation.includes("Fast mode")
      ? "The response is using a retrieval-grounded fallback summary instead of the full model-generated synthesis."
      : limitation,
  };
}

async function loadOrCreateConversation(body) {
  const existingConversation = body.conversationId
    ? await ConversationModel.findOne({
        _id: body.conversationId,
        userId: body.userId,
      })
    : null;

  const conversation =
    existingConversation ||
    (await ConversationModel.create({
      userId: body.userId,
      patientName: body.patientName,
      disease: body.disease,
      location: body.location,
      messages: [],
    }));

  if (body.patientName) conversation.patientName = body.patientName;
  if (body.location) conversation.location = body.location;

  return conversation;
}

function buildEvidence(llm) {
  return [
    ...(llm.ok
      ? llm.pubTop.map((publication) => ({
          id: publication.ref,
          kind: "publication",
          title: publication.title,
          year: publication.year,
          authors: publication.authors
            ? publication.authors.split(", ").filter(Boolean)
            : undefined,
          source: publication.source,
          url: publication.url,
          snippet: publication.snippet,
        }))
      : []),
    ...(llm.ok
      ? llm.trialTop.map((trial) => ({
          id: trial.ref,
          kind: "trial",
          title: trial.title,
          source: "ClinicalTrials.gov",
          url: trial.url,
          snippet: trial.eligibility,
        }))
      : []),
  ];
}

async function processChatRequest(env, body) {
  const conversation = await loadOrCreateConversation(body);
  const intent = detectIntent(body.query);
  const effectiveDisease = resolveDiseaseContext(
    body.disease,
    conversation.disease,
    body.query
  );
  const reuseContext = shouldReuseConversationContext(
    body.disease,
    conversation.disease,
    body.query
  );

  if (effectiveDisease) {
    conversation.disease = effectiveDisease;
  }

  conversation.messages.push({
    role: "user",
    content: body.query,
    createdAt: new Date(),
  });

  if (isGreeting(body.query)) {
    const greetingResponse = {
      condition_overview:
        "Hello. I'm ready to help with medical research, recent studies, and clinical trial discovery.",
      research_insights: [],
      clinical_trials: [],
      personalized_takeaways: [
        effectiveDisease
          ? `Current disease context: ${effectiveDisease}${conversation.location ? ` in ${conversation.location}` : ""}.`
          : "You can add a disease or condition to make answers more focused.",
      ],
      follow_up_questions: [
        "What condition or treatment would you like to research?",
        "Do you want recent studies, treatment options, or clinical trials?",
      ],
      limitations: "No retrieval was needed for a greeting.",
    };

    conversation.messages.push({
      role: "assistant",
      content: JSON.stringify(greetingResponse, null, 2),
      createdAt: new Date(),
      evidence: [],
    });
    await conversation.save();

    return {
      conversationId: String(conversation._id),
      expandedQuery: body.query,
      candidates: { openAlex: 0, pubMed: 0, trials: 0 },
      response: greetingResponse,
      publications: [],
      clinicalTrials: [],
      meta: {
        intent,
        cacheHit: false,
        reusedContext: reuseContext,
        totalFetched: 0,
        usedPublications: 0,
        usedTrials: 0,
      },
    };
  }

  const retrievalDisease = reuseContext ? conversation.disease : effectiveDisease;
  const cacheKey = buildCacheKey({
    disease: retrievalDisease || "",
    location: conversation.location || "",
    query: body.query.trim().toLowerCase(),
    provider: env.LLM_PROVIDER,
    model: env.OLLAMA_MODEL,
    hfModel: env.HF_MODEL,
    fastMode: env.CHAT_FAST_MODE,
    debugLlmOnly: env.CHAT_DEBUG_LLM_ONLY,
  });
  const cached = responseCache.get(cacheKey);

  let payload;
  let cacheHit = false;

  if (cached) {
    payload = cached;
    cacheHit = true;
  } else {
    const retrieval = env.CHAT_DEBUG_LLM_ONLY
      ? {
          expandedQuery: body.query,
          candidates: { openAlex: 0, pubMed: 0, trials: 0 },
          publications: [],
          trials: [],
        }
      : await retrieveAll({
          disease: retrievalDisease,
          query: body.query,
          location: conversation.location,
          openAlexMailto: env.OPENALEX_MAILTO,
          pubMedTool: env.PUBMED_TOOL,
          pubMedEmail: env.PUBMED_EMAIL,
          candidatesMax: env.CHAT_CANDIDATES_MAX,
        });

    let llm;

    if (env.CHAT_FAST_MODE) {
      llm = {
        ok: true,
        data: buildFallbackResponse(body, conversation, retrieval, {
          message: "Fast mode enabled: skipped Ollama summarization.",
        }),
        raw: "",
        error: "Fast mode enabled: skipped Ollama summarization.",
        pubTop: retrieval.publications.slice(0, 5).map((publication, index) => ({
          ref: `S${index + 1}`,
          title: publication.title,
          year: publication.year,
          authors: publication.authors?.slice(0, 3).join(", "),
          source: publication.source,
          url: publication.url,
          snippet: publication.abstract?.slice(0, 160),
        })),
        trialTop: retrieval.trials.slice(0, 3).map((trial, index) => ({
          ref: `T${index + 1}`,
          title: trial.title,
          url: trial.url,
          eligibility: trial.eligibility?.slice(0, 180),
        })),
      };
    } else {
      try {
        llm = await runOllamaReasoning({
          provider: env.LLM_PROVIDER,
          ollamaHost: env.OLLAMA_HOST,
          model: env.OLLAMA_MODEL,
          timeoutMs: env.OLLAMA_TIMEOUT_MS,
          hfApiKey: env.HF_API_KEY,
          hfModel: env.HF_MODEL,
          hfTimeoutMs: env.HF_TIMEOUT_MS,
          patientName: conversation.patientName,
          disease: retrievalDisease,
          location: conversation.location,
          userQuery: body.query,
          conversationContext: conversation.messages
            .filter((message) => message.role === "user" || message.role === "assistant")
            .slice(-6)
            .map((message) => ({ role: message.role, content: message.content })),
          publications: retrieval.publications,
          trials: retrieval.trials,
        });
      } catch (llmError) {
        console.error("Ollama fallback activated", llmError);
        llm = {
          ok: true,
          data: buildFallbackResponse(body, conversation, retrieval, llmError),
          raw: "",
          error: llmError?.message,
          pubTop: retrieval.publications.slice(0, 5).map((publication, index) => ({
            ref: `S${index + 1}`,
            title: publication.title,
            year: publication.year,
            authors: publication.authors?.slice(0, 3).join(", "),
            source: publication.source,
            url: publication.url,
            snippet: publication.abstract?.slice(0, 160),
          })),
          trialTop: retrieval.trials.slice(0, 3).map((trial, index) => ({
            ref: `T${index + 1}`,
            title: trial.title,
            url: trial.url,
            eligibility: trial.eligibility?.slice(0, 180),
          })),
        };
      }
    }

    const assistantContent = llm.ok
      ? JSON.stringify(llm.data, null, 2)
      : llm.raw || "I couldn't parse the model output. Try again.";

    payload = {
      conversationId: String(conversation._id),
      expandedQuery: retrieval.expandedQuery,
      candidates: retrieval.candidates,
      response: llm.ok ? llm.data : { raw: assistantContent, error: llm.error },
      publications: retrieval.publications.slice(0, 6),
      clinicalTrials: retrieval.trials.slice(0, 4),
      assistantContent,
      evidence: buildEvidence(llm),
      meta: {
        intent,
        cacheHit: false,
        reusedContext: reuseContext,
        totalFetched: retrieval.candidates.openAlex + retrieval.candidates.pubMed,
        usedPublications: Math.min(6, retrieval.publications.length),
        usedTrials: Math.min(4, retrieval.trials.length),
      },
    };

    responseCache.set(cacheKey, payload, env.CHAT_CACHE_TTL_MS);
  }

  conversation.messages.push({
    role: "assistant",
    content: payload.assistantContent || JSON.stringify(payload.response, null, 2),
    createdAt: new Date(),
    evidence: payload.evidence,
  });
  await conversation.save();

  return {
    conversationId: payload.conversationId,
    expandedQuery: payload.expandedQuery,
    candidates: payload.candidates,
    response: payload.response,
    publications: payload.publications,
    clinicalTrials: payload.clinicalTrials,
    meta: {
      ...payload.meta,
      cacheHit,
    },
  };
}

module.exports = { processChatRequest };
