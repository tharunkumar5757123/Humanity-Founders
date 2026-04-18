const { parseStringPromise } = require("xml2js");
const { fetchJson, fetchText } = require("../http");

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "_" in value) {
    return typeof value._ === "string" ? value._ : undefined;
  }
  return undefined;
}

function articleIdType(articleId) {
  if (!articleId || typeof articleId !== "object") return undefined;
  const attrs = articleId.$;
  return attrs && typeof attrs.IdType === "string" ? attrs.IdType : undefined;
}

function buildPubMedTerm(query, disease) {
  const trimmedQuery = (query || "").trim();
  const trimmedDisease = (disease || "").trim();
  if (!trimmedDisease) return trimmedQuery;

  if (trimmedQuery.toLowerCase().includes(trimmedDisease.toLowerCase())) {
    return trimmedQuery;
  }

  return `${trimmedQuery} AND ${trimmedDisease}`;
}

async function fetchPubMedPublications(opts) {
  const searchUrl = new URL(
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
  );
  searchUrl.searchParams.set("db", "pubmed");
  searchUrl.searchParams.set("term", buildPubMedTerm(opts.query, opts.disease));
  searchUrl.searchParams.set("retmax", String(Math.min(200, opts.max)));
  searchUrl.searchParams.set("sort", "pub+date");
  searchUrl.searchParams.set("retmode", "json");
  searchUrl.searchParams.set("tool", opts.tool);
  if (opts.email) searchUrl.searchParams.set("email", opts.email);

  const searchJson = await fetchJson(searchUrl, {}, 12000);
  const ids = searchJson.esearchresult?.idlist || [];
  if (ids.length === 0) return [];

  const batches = [];
  for (let index = 0; index < ids.length; index += 50) {
    batches.push(ids.slice(index, index + 50));
  }

  const publications = [];
  for (const batch of batches) {
    const fetchUrl = new URL(
      "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
    );
    fetchUrl.searchParams.set("db", "pubmed");
    fetchUrl.searchParams.set("id", batch.join(","));
    fetchUrl.searchParams.set("retmode", "xml");
    fetchUrl.searchParams.set("tool", opts.tool);
    if (opts.email) fetchUrl.searchParams.set("email", opts.email);

    const xml = await fetchText(fetchUrl, {}, 12000);
    const parsed = await parseStringPromise(xml, { explicitArray: false });
    const articles = asArray(parsed?.PubmedArticleSet?.PubmedArticle);

    for (const article of articles) {
      const medline = article?.MedlineCitation?.Article;
      const pmid = text(article?.MedlineCitation?.PMID);
      const title = text(medline?.ArticleTitle);
      const abstract =
        asArray(medline?.Abstract?.AbstractText)
          .map((item) => text(item))
          .filter(Boolean)
          .join("\n")
          .trim() || undefined;

      const authors = asArray(medline?.AuthorList?.Author)
        .map((author) => {
          const last = text(author?.LastName);
          const first = text(author?.ForeName);
          const collective = text(author?.CollectiveName);
          if (collective) return collective;
          if (!last && !first) return undefined;
          return [first, last].filter(Boolean).join(" ");
        })
        .filter(Boolean);

      const yearRaw =
        text(medline?.Journal?.JournalIssue?.PubDate?.Year) ||
        text(medline?.Journal?.JournalIssue?.PubDate?.MedlineDate);
      const yearMatch = yearRaw?.match(/\b(19|20)\d{2}\b/);
      const year = yearMatch ? Number(yearMatch[0]) : undefined;
      const doi = asArray(article?.PubmedData?.ArticleIdList?.ArticleId)
        .find((articleId) => articleIdType(articleId) === "doi");

      if (!pmid || !title) continue;
      publications.push({
        id: pmid,
        source: "PubMed",
        sources: ["PubMed"],
        title,
        abstract,
        authors,
        year,
        doi: text(doi),
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      });
    }
  }

  return publications.slice(0, opts.max);
}

module.exports = { fetchPubMedPublications };
