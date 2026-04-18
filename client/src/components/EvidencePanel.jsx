function publicationMeta(publication) {
  const pieces = [publication.source];
  if (publication.year) pieces.push(String(publication.year));
  if (publication.authors?.length) {
    const authors = publication.authors.slice(0, 4).join(", ");
    pieces.push(publication.authors.length > 4 ? `${authors}...` : authors);
  }
  return pieces.join(" | ");
}

export function EvidencePanel({ selectedMessage }) {
  return (
    <aside className="evidence-rail">
      <section className="panel-card">
        <div className="panel-card__header">
          <span className="panel-card__eyebrow">Evidence rail</span>
          <h2>Top supporting sources</h2>
        </div>
        <div className="rail-trust">
          <span className="trust-badge trust-badge--soft">Verified research trail</span>
        </div>

        {!selectedMessage || selectedMessage.role !== "assistant" ? (
          <p className="mini-note">Click an assistant answer to pin publications and clinical trials here.</p>
        ) : (
          <div className="evidence-stack">
            <div className="evidence-summary">
              <div className="detail-row">
                <span className="detail-row__label">Expanded query</span>
                <code>{selectedMessage.meta.expandedQuery}</code>
              </div>
              <div className="detail-row">
                <span className="detail-row__label">Candidate depth</span>
                <span>
                  PubMed {selectedMessage.meta.candidates.pubMed} | OpenAlex{" "}
                  {selectedMessage.meta.candidates.openAlex} | Trials {selectedMessage.meta.candidates.trials}
                </span>
              </div>
            </div>

            {selectedMessage.meta.publications.map((publication) => (
              <article key={`${publication.source}:${publication.id}`} className="evidence-card">
                <span className="evidence-card__type">Publication</span>
                <a href={publication.url} target="_blank" rel="noreferrer">
                  {publication.title}
                </a>
                <p className="evidence-card__meta">{publicationMeta(publication)}</p>
                {publication.abstract ? (
                  <p className="evidence-card__snippet">{publication.abstract.slice(0, 220)}...</p>
                ) : null}
              </article>
            ))}

            {selectedMessage.meta.clinicalTrials.map((trial) => (
              <article key={trial.id} className="evidence-card">
                <span className="evidence-card__type evidence-card__type--trial">Clinical trial</span>
                <a href={trial.url} target="_blank" rel="noreferrer">
                  {trial.title}
                </a>
                <p className="evidence-card__meta">{trial.status ? `Status: ${trial.status}` : "Clinical trial"}</p>
                {trial.locations?.[0] ? (
                  <p className="evidence-card__meta">Location: {trial.locations[0]}</p>
                ) : null}
                {trial.eligibility ? (
                  <p className="evidence-card__snippet">{trial.eligibility.slice(0, 220)}...</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}
