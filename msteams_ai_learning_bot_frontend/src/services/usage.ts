import { buildApiUrl, getSession } from "../config/api";

export interface UsageLogPayload {
  taskType: string;
  otherTaskDescription?: string;
  timeSaved: string;
  confidence: string;
  description?: string;
}

export const usageService = {
  async logUsage(entry: UsageLogPayload) {
    const session = getSession();
    if (!session) {
      throw new Error("You must be signed in to log usage");
    }

    const response = await fetch(buildApiUrl("/api/usage/log"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        ...entry,
        userId: session.user.id,
      }),
      credentials: "include",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(errorText || "Failed to log usage");
    }

    return response.json();
  },
};
