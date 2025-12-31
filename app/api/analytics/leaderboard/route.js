import { NextResponse } from "next/server";
import { containers } from "../../../../lib/cosmos";

function resolveType(searchParams) {
  const value = (searchParams.get("type") || "teams").toLowerCase();
  return value === "users" ? "users" : "teams";
}

function parseLimit(searchParams) {
  const value = Number(searchParams.get("limit"));
  if (!Number.isFinite(value) || value <= 0) {
    return 10;
  }
  return Math.min(100, Math.max(3, Math.round(value)));
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const type = resolveType(searchParams);
  const limit = parseLimit(searchParams);

  try {
    if (type === "teams") {
      const query = {
        query: "SELECT TOP @limit c.id, c.name, c.score, c.totalXP FROM c ORDER BY c.score DESC",
        parameters: [{ name: "@limit", value: limit }],
      };
      const { resources } = await containers.teams.items.query(query).fetchAll();
      return NextResponse.json({ type, entries: resources || [] });
    }

    const { resources } = await containers.rewards.items
      .query({ query: "SELECT TOP @limit c.id, c.userId, c.xp, c.streak FROM c ORDER BY c.xp DESC", parameters: [{ name: "@limit", value: limit }] })
      .fetchAll();

    const leaderboard = resources || [];
    if (leaderboard.length) {
      const userIds = leaderboard.map((record) => record.userId || record.id);
      const userQuery = {
        query: "SELECT c.id, c.name FROM c WHERE ARRAY_CONTAINS(@userIds, c.id)",
        parameters: [{ name: "@userIds", value: userIds }],
      };
      const { resources: users } = await containers.users.items.query(userQuery).fetchAll();
      const userMap = (users || []).reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {});

      leaderboard.forEach((entry) => {
        const profile = userMap[entry.userId || entry.id];
        entry.name = profile?.name || entry.userId || entry.id;
      });
    }

    return NextResponse.json({ type, entries: leaderboard });
  } catch (error) {
    console.error("[API analytics leaderboard]", error);
    return NextResponse.json({ error: "Failed to load leaderboard" }, { status: 500 });
  }
}
