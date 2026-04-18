const { tokenize } = require("./query");

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function recencyScore(year) {
  if (!year) return 0.35;
  const now = new Date().getUTCFullYear();
  const min = 2000;
  const denominator = Math.max(1, now - min);
  return clamp01((year - min) / denominator);
}

function credibilityScore(source) {
  return source === "PubMed" ? 1 : 0.85;
}

function sourceScore(source, sources) {
  if (sources?.includes("PubMed")) return 1;
  if (source === "PubMed") return 1;
  if (source === "OpenAlex") return 0.8;
  return 0.5;
}

function relevanceScore(queryTokens, haystack) {
  if (queryTokens.length === 0) return 0;
  const text = haystack.toLowerCase();
  let hits = 0;
  for (const token of queryTokens) {
    if (text.includes(token)) hits += 1;
  }
  return hits / queryTokens.length;
}

function keywordBoost(query, publication) {
  const queryText = (query || "").toLowerCase();
  const title = (publication.title || "").toLowerCase();
  const abstract = (publication.abstract || "").toLowerCase();
  let boost = 0;

  const boostedKeywords = tokenize(queryText).filter(
    (token) => !["compare", "comparison", "treatment", "treatments", "research"].includes(token)
  );

  for (const token of boostedKeywords) {
    if (title.includes(token)) boost += 0.12;
    else if (abstract.includes(token)) boost += 0.05;
  }

  if (queryText.includes("compare")) {
    if (title.includes("first-line") || abstract.includes("first-line")) boost += 0.22;
    if (title.includes("methotrexate") || abstract.includes("methotrexate")) boost += 0.24;
    if (title.includes("biologic") || abstract.includes("biologic")) boost += 0.18;
    if (title.includes("effectiveness") || abstract.includes("effectiveness")) boost += 0.14;
    if (title.includes("comparison") || abstract.includes("comparison")) boost += 0.14;
  }

  return Math.min(boost, 0.8);
}

function clinicalBoost(publication) {
  const text = `${publication.title || ""} ${publication.abstract || ""}`.toLowerCase();
  const keywords = ["trial", "phase", "randomized", "clinical", "cohort", "placebo"];
  let boost = 0;

  for (const keyword of keywords) {
    if (text.includes(keyword)) boost += 0.18;
  }

  return Math.min(boost, 1);
}

function firstLineBoost(publication) {
  const text = `${publication.title || ""} ${publication.abstract || ""}`.toLowerCase();
  if (text.includes("first-line") || text.includes("first line")) return 1;
  return 0;
}

function rerankPublications(query, publications) {
  const queryTokens = tokenize(query);
  return publications
    .map((publication) => {
      const text = `${publication.title}\n${publication.abstract || ""}`;
      const relevance = relevanceScore(queryTokens, text);
      const recency = recencyScore(publication.year);
      const credibility = publication.sources?.includes("PubMed")
        ? 1
        : credibilityScore(publication.source);
      const source = sourceScore(publication.source, publication.sources);
      const boost = keywordBoost(query, publication);
      const clinical = clinicalBoost(publication);
      const firstLine = firstLineBoost(publication);
      const score =
        0.6 * relevance +
        0.25 * recency +
        0.1 * source +
        0.05 * clinical +
        0.2 * firstLine +
        0.05 * credibility +
        0.1 * boost;
      return { publication, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.publication);
}

function rerankTrials(query, trials, locationHint) {
  const queryTokens = tokenize(query);
  const locationTokens = locationHint ? tokenize(locationHint) : [];

  return trials
    .map((trial) => {
      const relevance = relevanceScore(
        queryTokens,
        `${trial.title}\n${trial.eligibility || ""}`
      );
      const status = (trial.status || "").toUpperCase();
      const statusScore =
        status.includes("RECRUITING") || status.includes("ENROLLING") ? 1 : 0.8;
      const locationScore =
        locationTokens.length === 0
          ? 0
          : relevanceScore(locationTokens, `${trial.locations.join(" ")} ${trial.title}`);
      const score = 0.7 * relevance + 0.2 * statusScore + 0.1 * locationScore;
      return { trial, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.trial);
}

module.exports = { rerankPublications, rerankTrials };
