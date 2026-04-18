import { useEffect, useRef, useState } from "react";
import "./App.css";
import { postChat } from "./api";
import { getOrCreateUserId } from "./userId";
import { TopBar } from "./components/TopBar";
import { PatientPanel } from "./components/PatientPanel";
import { ChatPanel } from "./components/ChatPanel";
import { EvidencePanel } from "./components/EvidencePanel";

const CONVO_KEY = "curalink_conversation_id";

export default function App() {
  const modelLabel = import.meta.env.VITE_OLLAMA_MODEL || "local model";
  const [userId] = useState(() => getOrCreateUserId());
  const [conversationId, setConversationId] = useState(
    () => localStorage.getItem(CONVO_KEY) || undefined
  );
  const [patientName, setPatientName] = useState("");
  const [disease, setDisease] = useState("");
  const [location, setLocation] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [rightPane, setRightPane] = useState(null);
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState("");

  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages.length]);

  async function submitQuery(rawQuery) {
    const trimmedQuery = rawQuery.trim();
    if (!trimmedQuery || busy) return;

    setError(null);
    setBusy(true);
    setLastSubmittedQuery(trimmedQuery);
    setMessages((current) => [...current, { role: "user", content: trimmedQuery }]);
    setQuery("");

    try {
      const response = await postChat({
        userId,
        conversationId,
        patientName: patientName.trim() || undefined,
        disease: disease.trim() || undefined,
        location: location.trim() || undefined,
        query: trimmedQuery,
      });

      setConversationId(response.conversationId);
      localStorage.setItem(CONVO_KEY, response.conversationId);

      const assistantMessage = {
        role: "assistant",
        content: response.response,
        meta: {
          expandedQuery: response.expandedQuery,
          candidates: response.candidates,
          publications: response.publications,
          clinicalTrials: response.clinicalTrials,
        },
      };

      setMessages((current) => [...current, assistantMessage]);
      setRightPane(assistantMessage);
    } catch (requestError) {
      setError(requestError?.message || "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSend(event) {
    event.preventDefault();
    await submitQuery(query);
  }

  async function handleSuggestedQuery(nextQuery, options = {}) {
    setQuery(nextQuery);

    if (options.submit) {
      await submitQuery(nextQuery);
    }
  }

  function newConversation() {
    localStorage.removeItem(CONVO_KEY);
    setConversationId(undefined);
    setMessages([]);
    setRightPane(null);
    setError(null);
    setLastSubmittedQuery("");
  }

  return (
    <div className="app">
      <TopBar busy={busy} onNewConversation={newConversation} modelLabel={modelLabel} />

      <div className="workspace">
        <PatientPanel
          patientName={patientName}
          disease={disease}
          location={location}
          conversationId={conversationId}
          onPatientNameChange={setPatientName}
          onDiseaseChange={setDisease}
          onLocationChange={setLocation}
          onSuggestedQuery={handleSuggestedQuery}
        />

        <ChatPanel
          listRef={listRef}
          messages={messages}
          query={query}
          busy={busy}
          error={error}
          lastSubmittedQuery={lastSubmittedQuery}
          onQueryChange={setQuery}
          onSend={onSend}
          onPinMessage={setRightPane}
          onSuggestedQuery={handleSuggestedQuery}
          onRegenerate={() => handleSuggestedQuery(lastSubmittedQuery, { submit: true })}
        />

        <EvidencePanel selectedMessage={rightPane} />
      </div>
    </div>
  );
}
