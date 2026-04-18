export function TopBar({ busy, onNewConversation, modelLabel }) {
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <div className="topbar__eyebrow">Curalink AI</div>
        <h1>Curalink</h1>
        <p>
          Real-time medical research assistant with evidence-backed retrieval, clinical reasoning,
          and {modelLabel} synthesis.
        </p>
        <div className="trust-strip">
          <span className="trust-badge">Evidence-backed from PubMed, OpenAlex, and ClinicalTrials</span>
          <span className="trust-badge trust-badge--soft">Medical AI research assistant</span>
        </div>
      </div>

      <div className="topbar__actions">
        <div className="status-pill">
          <span className={`status-pill__dot ${busy ? "is-busy" : ""}`} />
          {busy ? "Searching sources" : "Ready"}
        </div>
        <button className="button button--ghost" onClick={onNewConversation} disabled={busy}>
          New chat
        </button>
      </div>
    </header>
  );
}
