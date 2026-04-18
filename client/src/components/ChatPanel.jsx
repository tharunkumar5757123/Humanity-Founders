import { AssistantResponse } from "./AssistantResponse";

export function ChatPanel({
  listRef,
  messages,
  query,
  busy,
  error,
  lastSubmittedQuery,
  onQueryChange,
  onSend,
  onPinMessage,
  onSuggestedQuery,
  onRegenerate,
}) {
  const starterSearches = [
    {
      label: "Treatment options",
      query: "Compare first-line treatments for rheumatoid arthritis",
    },
    {
      label: "Clinical trials",
      query: "Recruiting clinical trials for Alzheimer's disease",
    },
    {
      label: "Recent evidence",
      query: "Recent research on immunotherapy for melanoma",
    },
  ];

  return (
    <main className="chat-shell">
      <section className="chat-feed" ref={listRef}>
        <div className="trust-banner">
          <strong>Evidence-backed</strong>
          <span>Multi-source retrieval, reranking, and structured medical research summaries.</span>
        </div>

        {messages.length === 0 ? (
          <article className="empty-state">
            <span className="empty-state__eyebrow">Start here</span>
            <h2>Ask a medical research question and pull evidence from live sources.</h2>
            <p>
              Click any starter below to search instantly, or write your own question with disease context on the
              left.
            </p>

            <div className="empty-state__actions">
              {starterSearches.map((item) => (
                <button
                  key={item.query}
                  type="button"
                  className="starter-card"
                  onClick={() => onSuggestedQuery(item.query, { submit: true })}
                >
                  <span className="starter-card__label">{item.label}</span>
                  <strong>{item.query}</strong>
                  <span className="starter-card__hint">Click to search</span>
                </button>
              ))}
            </div>
          </article>
        ) : null}

        {messages.map((message, index) => {
          if (message.role === "user") {
            return (
              <article key={index} className="message-card message-card--user">
                <div className="message-card__label">You</div>
                <p>{message.content}</p>
              </article>
            );
          }

          return (
            <AssistantResponse
              key={index}
              message={message}
              onPin={() => onPinMessage(message)}
            />
          );
        })}

        {busy ? (
          <article className="message-card message-card--assistant message-card--loading">
            <div className="message-card__label">Curalink AI</div>
            <div className="skeleton-block" />
            <div className="skeleton-line" />
            <div className="skeleton-line skeleton-line--short" />
            <div className="typing-indicator">
              Synthesizing evidence<span className="typing-cursor" />
            </div>
          </article>
        ) : null}
      </section>

      <section className="composer-card">
        <form className="composer-form" onSubmit={onSend}>
          <label className="field field--composer">
            <span>Research question</span>
            <textarea
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="e.g. Deep brain stimulation for advanced Parkinson's disease"
              disabled={busy}
            />
          </label>
          <button className="button button--primary" type="submit" disabled={busy || !query.trim()}>
            {busy ? "Searching..." : "Search research"}
          </button>
        </form>

        <div className="composer-footer">
          <span className="mini-note">
            Responses are grounded in retrieved publications and trials, not generic chatbot text.
          </span>
          {lastSubmittedQuery ? (
            <button
              className="button button--ghost button--inline"
              type="button"
              onClick={onRegenerate}
              disabled={busy}
            >
              Regenerate response
            </button>
          ) : null}
        </div>

        {error ? <p className="form-error">Error: {error}</p> : null}
      </section>
    </main>
  );
}
