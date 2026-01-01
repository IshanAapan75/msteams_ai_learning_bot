import type { AnalyticsScope } from "../types/analytics";


const resolveDefaultBaseUrl = () => {
  return import.meta.env.VITE_API_BASE_URL;
};

const STORAGE_KEY = "momentum_session";

export const apiConfig = {
  baseUrl: resolveDefaultBaseUrl(),
  defaultScope: (import.meta.env.VITE_DEFAULT_SCOPE as AnalyticsScope) || "personal",
};

export type StoredSession = {
  token: string;
  user: {
    id: string;
    email: string;
    name?: string;
    teamId?: string | null;
  };
};

export function getSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Failed to parse stored session", error);
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveSession(session: StoredSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function buildApiUrl(path: string, params?: Record<string, string | number | undefined>) {
  const url = new URL(path, apiConfig.baseUrl);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}
