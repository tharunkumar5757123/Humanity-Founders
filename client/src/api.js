function normalizeErrorMessage(payload) {
  if (!payload) return undefined;
  if (typeof payload === "string") return payload.trim() || undefined;
  if (typeof payload.error === "string") return payload.error.trim() || undefined;
  if (typeof payload.message === "string") return payload.message.trim() || undefined;
  return undefined;
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://humanity-founders-ltau.onrender.com";

export async function postChat(input) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch (error) {
    throw new Error(
      `Unable to reach the server at ${API_BASE_URL}.`
    );
  }

  if (!response.ok) {
    const bodyText = await response.text();
    let parsed;

    try {
      parsed = JSON.parse(bodyText);
    } catch {
      parsed = undefined;
    }

    throw new Error(
      normalizeErrorMessage(parsed) || bodyText.trim() || `Request failed (${response.status})`
    );
  }

  return response.json();
}
