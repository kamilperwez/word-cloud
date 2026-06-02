const SESSION_ID_KEY = "teams-polls-session-id";

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";

  const existing = window.sessionStorage.getItem(SESSION_ID_KEY);
  if (existing) return existing;

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.sessionStorage.setItem(SESSION_ID_KEY, id);
  return id;
}
