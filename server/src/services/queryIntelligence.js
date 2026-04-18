const { queryHasExplicitDisease } = require("../retrieval/query");

function detectIntent(query) {
  const normalized = (query || "").toLowerCase();
  if (/\btrial|recruiting|eligibility\b/.test(normalized)) return "clinical_trials";
  if (/\bcompare|comparison|versus|vs\b/.test(normalized)) return "comparison";
  if (/\btreatment|therapy|drug|medication\b/.test(normalized)) return "treatment";
  if (/\bresearch|study|studies|evidence\b/.test(normalized)) return "research";
  return "general";
}

function shouldReuseConversationContext(bodyDisease, conversationDisease, query) {
  if (!conversationDisease) return false;
  if ((bodyDisease || "").trim()) return false;
  if (queryHasExplicitDisease(query)) return false;
  return true;
}

function buildCacheKey(parts) {
  return JSON.stringify(parts);
}

module.exports = { detectIntent, shouldReuseConversationContext, buildCacheKey };
