export function PatientPanel({
  patientName,
  disease,
  location,
  conversationId,
  onPatientNameChange,
  onDiseaseChange,
  onLocationChange,
  onSuggestedQuery,
}) {
  const suggestedPrompts = [
    "Latest treatment research for lung cancer",
    "Clinical trials for type 2 diabetes",
    "Recent studies on heart failure treatment",
    "Deep brain stimulation for Parkinson's disease",
  ];

  return (
    <aside className="sidebar">
      <section className="panel-card panel-card--soft">
        <div className="panel-card__header">
          <span className="panel-card__eyebrow">Patient context</span>
          <h2>Research framing</h2>
        </div>

        <div className="field-grid">
          <label className="field">
            <span>Patient name</span>
            <input
              value={patientName}
              onChange={(event) => onPatientNameChange(event.target.value)}
              placeholder="John Smith"
            />
          </label>

          <label className="field">
            <span>Disease or condition</span>
            <input
              value={disease}
              onChange={(event) => onDiseaseChange(event.target.value)}
              placeholder="Parkinson's disease"
            />
          </label>

          <label className="field">
            <span>Location</span>
            <input
              value={location}
              onChange={(event) => onLocationChange(event.target.value)}
              placeholder="Toronto, Canada"
            />
          </label>
        </div>

        <div className="insight-stack">
          <div className="trust-badge">Context-aware follow-up memory enabled</div>
          <div className="mini-note">
            Follow-up prompts reuse this context, so short next questions still stay disease-aware.
          </div>
          <div className="detail-row">
            <span className="detail-row__label">Conversation</span>
            <code>{conversationId || "new"}</code>
          </div>
        </div>
      </section>

      <section className="panel-card panel-card--accent">
        <div className="panel-card__header">
          <span className="panel-card__eyebrow">Suggested prompts</span>
          <h2>Good demo queries</h2>
        </div>

        <div className="prompt-stack">
          {suggestedPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="prompt-chip"
              onClick={() => onSuggestedQuery(prompt, { submit: true })}
            >
              <span>{prompt}</span>
              <strong>Search now</strong>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
