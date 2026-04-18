function expandQuery(disease, query) {
  const trimmedQuery = query.trim();
  const trimmedDisease = (disease || "").trim();
  if (!trimmedDisease) return trimmedQuery;

  const lower = trimmedQuery.toLowerCase();
  if (lower.includes(trimmedDisease.toLowerCase())) return trimmedQuery;
  return `${trimmedQuery} ${trimmedDisease}`.trim();
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

const KNOWN_DISEASE_PATTERNS = [
  { label: "Parkinson's disease", pattern: /\bparkinson(?:'s)? disease\b/i },
  { label: "Alzheimer's disease", pattern: /\balzheimer(?:'s)? disease\b/i },
  { label: "lung cancer", pattern: /\blung cancer\b/i },
  { label: "type 2 diabetes", pattern: /\btype 2 diabetes\b/i },
  { label: "diabetes", pattern: /\bdiabetes\b/i },
  { label: "heart failure", pattern: /\bheart failure\b/i },
  { label: "heart disease", pattern: /\bheart disease\b/i },
  { label: "melanoma", pattern: /\bmelanoma\b/i },
  { label: "rheumatoid arthritis", pattern: /\brheumatoid arthritis\b/i },
];

function inferDiseaseFromQuery(query) {
  const trimmedQuery = (query || "").trim();
  if (!trimmedQuery) return undefined;

  const matched = KNOWN_DISEASE_PATTERNS.find((item) => item.pattern.test(trimmedQuery));
  return matched?.label;
}

function queryHasExplicitDisease(query) {
  return Boolean(inferDiseaseFromQuery(query));
}

function resolveDiseaseContext(explicitDisease, conversationDisease, query) {
  const trimmedExplicit = (explicitDisease || "").trim();
  if (trimmedExplicit) return trimmedExplicit;

  const inferredDisease = inferDiseaseFromQuery(query);
  if (inferredDisease) return inferredDisease;

  const trimmedConversation = (conversationDisease || "").trim();
  return trimmedConversation || undefined;
}

function diseaseTokens(disease) {
  return tokenize(disease).filter(
    (token) => !["disease", "syndrome", "disorder", "chronic", "acute"].includes(token)
  );
}

module.exports = {
  expandQuery,
  tokenize,
  inferDiseaseFromQuery,
  queryHasExplicitDisease,
  resolveDiseaseContext,
  diseaseTokens,
};
