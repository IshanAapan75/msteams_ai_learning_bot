import { apiConfig, buildApiUrl, getSession } from "../config/api";

async function fetchJson<T>(path: string, params?: Record<string, string | number | undefined>, init?: RequestInit): Promise<T> {
  const url = buildApiUrl(path, params);
  const session = getSession();
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    ...init,
    credentials: "include",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Request failed (${response.status}): ${errorText || response.statusText}`);
  }

  return response.json();
}

function buildQuery(params?: Record<string, string | number | undefined>) {
  const session = getSession();
  return {
    ...(session?.user?.id ? { userId: session.user.id } : {}),
    scope: apiConfig.defaultScope,
    ...params,
  };
}

export const analyticsService = {
  getOverview(params?: Record<string, string | number | undefined>) {
    return fetchJson("/api/analytics/overview", buildQuery(params));
  },
  getTrend(params?: Record<string, string | number | undefined>) {
    return fetchJson("/api/analytics/trend", buildQuery(params));
  },
  getHabits(params?: Record<string, string | number | undefined>) {
    return fetchJson("/api/analytics/habits", buildQuery(params));
  },
  getLearning(params?: Record<string, string | number | undefined>) {
    return fetchJson("/api/analytics/learning", buildQuery(params));
  },
  getQuiz(params?: Record<string, string | number | undefined>) {
    return fetchJson("/api/analytics/quiz", buildQuery(params));
  },
  getWins(params?: Record<string, string | number | undefined>) {
    return fetchJson("/api/analytics/wins", buildQuery(params));
  },
  getTeam(params?: Record<string, string | number | undefined>) {
    return fetchJson("/api/analytics/team", buildQuery(params));
  },
  getLeaderboard(params?: Record<string, string | number | undefined>) {
    return fetchJson("/api/analytics/leaderboard", params);
  },
  getOrgTrend(params?: Record<string, string | number | undefined>) {
    return fetchJson("/api/analytics/org-trend", params);
  },
};
