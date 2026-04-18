import { useEffect, useMemo, useState } from "react";

function joinItems(items) {
  return items.join(" | ");
}

export function AssistantResponse({ message, onPin }) {
  const content = message.content;
  const isStructured = content && typeof content === "object" && "condition_overview" in content;
  const overviewText = content?.condition_overview || "";
  const [visibleChars, setVisibleChars] = useState(overviewText.length);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setVisibleChars(0);
    const timer = setInterval(() => {
      setVisibleChars((current) => {
        if (current >= overviewText.length) {
          clearInterval(timer);
          return current;
        }
        return current + 3;
      });
    }, 12);

    return () => clearInterval(timer);
  }, [overviewText]);

  const typedOverview = overviewText.slice(0, visibleChars);
  const finishedTyping = visibleChars >= overviewText.length;
  const copyText = useMemo(() => JSON.stringify(content, null, 2), [content]);

  async function handleCopy(event) {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className="message-card message-card--assistant" onClick={onPin}>
      <div className="message-card__header">
        <div className="message-card__label">Curalink AI</div>
        <button className="button button--ghost button--inline" type="button" onClick={handleCopy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {isStructured ? (
        <>
          <div className="response-block">
            <h3>Condition overview</h3>
            <p>
              {typedOverview}
              {!finishedTyping ? <span className="typing-cursor" /> : null}
            </p>
          </div>

          {finishedTyping && content.first_line_treatments?.length ? (
            <div className="response-block">
              <h3>First-line treatments</h3>
              {content.first_line_treatments.map((item, index) => (
                <p key={`${item}-${index}`}>
                  <strong>{item}</strong>
                </p>
              ))}
            </div>
          ) : null}

          {finishedTyping && content.comparison_table?.length ? (
            <div className="response-block">
              <h3>Comparison</h3>
              <div className="comparison-table">
                <div className="comparison-table__head">
                  <span>Treatment</span>
                  <span>Mechanism</span>
                  <span>Effectiveness</span>
                  <span>When Used</span>
                  <span>Limitations</span>
                </div>
                {content.comparison_table.map((row, index) => (
                  <div className="comparison-table__row" key={`${row.treatment}-${index}`}>
                    <span>
                      <strong>{row.treatment}</strong>
                    </span>
                    <span>{row.mechanism || "-"}</span>
                    <span>{row.effectiveness || "-"}</span>
                    <span>{row.when_used || "-"}</span>
                    <span>{row.limitations || "-"}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {finishedTyping && content.research_insights?.length ? (
            <div className="response-block">
              <h3>Research insights</h3>
              {content.research_insights.map((item, index) => (
                <p key={`${item.claim}-${index}`}>
                  <strong>{item.claim}</strong>
                  {item.notes ? ` ${item.notes}` : ""}
                </p>
              ))}
            </div>
          ) : null}

          {finishedTyping && content.clinical_trials?.length ? (
            <div className="response-block">
              <h3>Clinical trials</h3>
              {content.clinical_trials.map((trial, index) => (
                <p key={`${trial.trial_id}-${index}`}>
                  <strong>{trial.trial_id}</strong>: {trial.why_relevant}
                  {trial.status ? ` (${trial.status})` : ""}
                </p>
              ))}
            </div>
          ) : null}

          {finishedTyping && content.personalized_takeaways?.length ? (
            <div className="response-block">
              <h3>Personalized takeaways</h3>
              <p>{joinItems(content.personalized_takeaways)}</p>
            </div>
          ) : null}

          {finishedTyping && content.follow_up_questions?.length ? (
            <div className="response-block">
              <h3>Follow-up questions</h3>
              <p>{joinItems(content.follow_up_questions)}</p>
            </div>
          ) : null}
        </>
      ) : (
        <pre>{content.raw}</pre>
      )}

      <div className="message-meta">
        Expanded query: <code>{message.meta.expandedQuery}</code> | Candidates: PubMed{" "}
        {message.meta.candidates.pubMed} | OpenAlex {message.meta.candidates.openAlex} | Trials{" "}
        {message.meta.candidates.trials}
      </div>
    </article>
  );
}
