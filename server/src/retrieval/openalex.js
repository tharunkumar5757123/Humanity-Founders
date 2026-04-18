const { fetchJson } = require("../http");

function invertedIndexToText(index) {
  if (!index) return undefined;

  const positions = {};
  for (const [word, positionList] of Object.entries(index)) {
    for (const position of positionList) {
      positions[position] = word;
    }
  }

  const ordered = Object.keys(positions)
    .map(Number)
    .sort((a, b) => a - b)
    .map((key) => positions[key]);

  const text = ordered.join(" ").trim();
  return text || undefined;
}

async function fetchOpenAlexPublications(opts) {
  const perPage = Math.min(200, Math.max(25, Math.floor(opts.max / 2)));
  const base = new URL("https://api.openalex.org/works");
  base.searchParams.set("search", opts.query);
  base.searchParams.set("per-page", String(perPage));
  base.searchParams.set("page", "1");
  base.searchParams.set("sort", "relevance_score:desc");
  if (opts.mailto) base.searchParams.set("mailto", opts.mailto);

  const newest = new URL(base.toString());
  newest.searchParams.set("sort", "publication_date:desc");

  const [relRes, newRes] = await Promise.all([
    fetchJson(base, {}, 12000),
    fetchJson(newest, {}, 12000),
  ]);

  const byId = new Map();
  for (const work of [...(relRes.results || []), ...(newRes.results || [])]) {
    const id = work.id;
    const title = work.display_name || work.title;
    if (!id || !title) continue;

    const authors =
      work.authorships
        ?.map((authorship) => authorship.author?.display_name)
        .filter(Boolean) || [];

    byId.set(id, {
      id,
      source: "OpenAlex",
      sources: ["OpenAlex"],
      title,
      abstract: invertedIndexToText(work.abstract_inverted_index),
      authors,
      year: work.publication_year,
      doi: typeof work.doi === "string" ? work.doi : undefined,
      url: work.primary_location?.landing_page_url || id,
    });
  }

  return Array.from(byId.values()).slice(0, opts.max);
}

module.exports = { fetchOpenAlexPublications };
