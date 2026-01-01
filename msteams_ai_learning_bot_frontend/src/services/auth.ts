import { buildApiUrl, clearSession, getSession, saveSession, type StoredSession } from "../config/api";

interface AuthResponse {
  token: string;
  user: StoredSession["user"];
}

async function postJson<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const url = buildApiUrl(path);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || response.statusText || "Request failed");
  }

  return response.json();
}

export const authService = {
  async precheck(email: string) {
    return postJson<{ exists: boolean; hasPassword: boolean }>("/api/auth/precheck", { email });
  },

  async login(email: string, password: string) {
    const result = await postJson<AuthResponse>("/api/auth/login", { email, password });
    saveSession({ token: result.token, user: result.user });
    return result.user;
  },

  async claim(email: string, password: string) {
    const result = await postJson<AuthResponse>("/api/auth/claim", { email, password });
    saveSession({ token: result.token, user: result.user });
    return result.user;
  },

  getSession: () => getSession(),
  clearSession: () => clearSession(),
};
