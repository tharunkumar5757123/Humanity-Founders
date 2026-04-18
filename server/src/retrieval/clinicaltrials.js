const { fetchJson } = require("../http");

function compactLocation(location) {
  const parts = [
    location.facility,
    location.city,
    location.state,
    location.country,
  ].filter(Boolean);
  return parts.join(", ");
}

async function fetchClinicalTrials(opts) {
  const url = new URL("https://clinicaltrials.gov/api/v2/studies");
  url.searchParams.set("query.cond", opts.disease);
  url.searchParams.set("query.term", opts.query);
  url.searchParams.set("pageSize", String(Math.min(100, opts.max)));
  url.searchParams.set("format", "json");

  const json = await fetchJson(url, {}, 12000);
  const studies = json.studies || [];

  const trials = [];
  for (const study of studies) {
    const id = study.protocolSection?.identificationModule?.nctId;
    const title = study.protocolSection?.identificationModule?.briefTitle;
    if (!id || !title) continue;

    const status = study.protocolSection?.statusModule?.overallStatus;
    const eligibility = study.protocolSection?.eligibilityModule?.eligibilityCriteria;
    const locations =
      study.protocolSection?.contactsLocationsModule?.locations
        ?.map(compactLocation)
        .filter((item) => item.length > 0) || [];
    const contact = study.protocolSection?.contactsLocationsModule?.centralContact;
    const contacts = [
      [contact?.name, contact?.phone, contact?.email].filter(Boolean).join(" | "),
    ].filter((item) => item.length > 0);

    trials.push({
      id,
      title,
      status,
      eligibility: eligibility?.slice(0, 1200),
      locations: locations.slice(0, 10),
      contacts,
      url: `https://clinicaltrials.gov/study/${id}`,
    });
  }

  return trials.slice(0, opts.max);
}

module.exports = { fetchClinicalTrials };
