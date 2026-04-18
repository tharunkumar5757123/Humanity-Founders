const KEY = "curalink_user_id";

export function getOrCreateUserId() {
  const existing = localStorage.getItem(KEY);
  if (existing) return existing;

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `u_${Math.random().toString(16).slice(2)}_${Date.now()}`;

  localStorage.setItem(KEY, id);
  return id;
}

