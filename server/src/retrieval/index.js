const { expandQuery, diseaseTokens, tokenize } = require("./query");
const { fetchOpenAlexPublications } = require("./openalex");
const { fetchPubMedPublications } = require("./pubmed");
const { fetchClinicalTrials } = require("./clinicaltrials");
const { rerankPublications, rerankTrials } = require("./rerank");

function normalizeText(value) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function publicationKey(publication) {
  if (publication.doi) return `doi:${publication.doi.toLowerCase()}`;
  return `title:${normalizeText(publication.title)}|year:${publication.year || "na"}`;
}

function mergePublication(existing, incoming) {
  const mergedSources = Array.from(
    new Set([...(existing.sources || [existing.source]), ...(incoming.sources || [incoming.source])])
  );
  const preferred = mergedSources.includes("PubMed") ? "PubMed" : existing.source || incoming.source;

  return {
    ...existing,
    ...incoming,
    id: existing.id || incoming.id,
    source: preferred,
    sources: mergedSources,
    title: existing.title || incoming.title,
    abstract:
      existing.abstract && existing.abstract.length >= (incoming.abstract || "").length
        ? existing.abstract
        : incoming.abstract || existing.abstract,
    authors:
      existing.authors && existing.authors.length >= (incoming.authors || []).length
        ? existing.authors
        : incoming.authors || existing.authors,
    year: existing.year || incoming.year,
    doi: existing.doi || incoming.doi,
    url:
      preferred === "PubMed"
        ? existing.source === "PubMed"
          ? existing.url
          : incoming.source === "PubMed"
            ? incoming.url
            : existing.url || incoming.url
        : existing.url || incoming.url,
  };
}

function filterPublicationsByDisease(publications, disease) {
  const tokens = diseaseTokens(disease);
  if (tokens.length === 0) return publications;

  const filtered = publications.filter((publication) => {
    const haystack = `${publication.title || ""}\n${publication.abstract || ""}`.toLowerCase();
    return tokens.some((token) => haystack.includes(token));
  });

  return filtered.length > 0 ? filtered : publications;
}

function coreQueryTokens(query, disease) {
  const diseaseTokenSet = new Set(diseaseTokens(disease));
  const stopwords = new Set([
    "compare",
    "comparison",
    "versus",
    "with",
    "about",
    "latest",
    "recent",
    "studies",
    "study",
    "research",
    "treatment",
    "treatments",
    "therapy",
    "therapies",
    "disease",
    "clinical",
    "trial",
    "trials",
    "first",
    "line",
  ]);

  return tokenize(query).filter(
    (token) => !diseaseTokenSet.has(token) && !stopwords.has(token)
  );
}

function filterPublicationsByRelevance(publications, disease, query) {
  const diseaseTokenList = diseaseTokens(disease);
  const queryTokenList = coreQueryTokens(query, disease);
  if (diseaseTokenList.length === 0) return publications;

  const filtered = publications.filter((publication) => {
    const haystack = `${publication.title || ""} ${publication.abstract || ""}`.toLowerCase();
    const diseaseMatch = diseaseTokenList.some((token) => haystack.includes(token));
    const queryMatch =
      queryTokenList.length === 0 ||
      queryTokenList.some((token) => haystack.includes(token));

    return diseaseMatch && queryMatch;
  });

  return filtered.length > 0 ? filtered : publications;
}

function strictComparisonFilter(publications, query) {
  if (!/\bcompare|comparison|versus|vs|first-line|first line\b/i.test(query || "")) {
    return publications;
  }

  const queryTokenList = tokenize(query).filter(
    (token) =>
      ![
        "compare",
        "comparison",
        "versus",
        "with",
        "about",
        "treatment",
        "treatments",
        "therapy",
        "therapies",
        "disease",
      ].includes(token)
  );

  const filtered = publications.filter((publication) => {
    const text = `${publication.title || ""} ${publication.abstract || ""}`.toLowerCase();
    const tokenMatches = queryTokenList.filter((token) => text.includes(token)).length;
    const hasFirstLineSignal =
      text.includes("first-line") ||
      text.includes("first line") ||
      text.includes("methotrexate") ||
      text.includes("biologic") ||
      text.includes("jak");

    return tokenMatches >= Math.max(1, Math.floor(queryTokenList.length / 3)) && hasFirstLineSignal;
  });

  return filtered.length > 0 ? filtered : publications;
}

async function retrieveAll(opts) {
  const candidatesMax = Math.max(50, Math.min(300, opts.candidatesMax ?? 200));
  const expandedQuery = expandQuery(opts.disease, opts.query);

  const [openAlexResult, pubMedResult, trialsResult] = await Promise.allSettled([
    fetchOpenAlexPublications({
      query: expandedQuery,
      max: Math.min(200, candidatesMax),
      mailto: opts.openAlexMailto,
    }),
    fetchPubMedPublications({
      query: opts.query,
      disease: opts.disease,
      max: Math.min(200, candidatesMax),
      tool: opts.pubMedTool,
      email: opts.pubMedEmail,
    }),
    opts.disease
      ? fetchClinicalTrials({
          disease: opts.disease,
          query: opts.query,
          max: Math.min(100, candidatesMax),
        })
      : Promise.resolve([]),
  ]);

  const openAlex = openAlexResult.status === "fulfilled" ? openAlexResult.value : [];
  const pubMed = pubMedResult.status === "fulfilled" ? pubMedResult.value : [];
  const trials = trialsResult.status === "fulfilled" ? trialsResult.value : [];

  const publicationsByKey = new Map();
  for (const publication of [...pubMed, ...openAlex]) {
    const key = publicationKey(publication);
    const existing = publicationsByKey.get(key);
    publicationsByKey.set(key, existing ? mergePublication(existing, publication) : publication);
  }

  const mergedPublications = Array.from(publicationsByKey.values());
  const diseaseFiltered = filterPublicationsByDisease(mergedPublications, opts.disease);
  const relevanceFiltered = filterPublicationsByRelevance(
    diseaseFiltered,
    opts.disease,
    opts.query
  );
  const filteredPublications = strictComparisonFilter(relevanceFiltered, opts.query);
  const rankedPublications = rerankPublications(expandedQuery, filteredPublications);
  const rankedTrials = rerankTrials(expandedQuery, trials, opts.location);

  return {
    expandedQuery,
    candidates: {
      openAlex: openAlex.length,
      pubMed: pubMed.length,
      trials: trials.length,
    },
    publications: rankedPublications,
    trials: rankedTrials,
  };
}

module.exports = { retrieveAll };
