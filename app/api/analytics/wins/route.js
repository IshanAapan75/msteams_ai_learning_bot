import { NextResponse } from "next/server";
import {
  buildWinLogFromRewards,
  fetchRewardsForUsers,
  fetchTeamMembers,
  getAccessibleTeamIds,
  getRewardsByUserId,
  getUserById,
  isManager,
} from "../../../../lib/analytics";
import { containers } from "../../../../lib/cosmos";

function resolveScope(searchParams) {
  const scope = (searchParams.get("scope") || "personal").toLowerCase();
  if (["personal", "team", "org"].includes(scope)) {
    return scope;
  }
  return "personal";
}

function parseLimit(searchParams) {
  const value = Number(searchParams.get("limit"));
  if (!Number.isFinite(value) || value <= 0) {
    return 10;
  }
  return Math.min(50, Math.max(1, Math.round(value)));
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const scope = resolveScope(searchParams);
  const teamId = searchParams.get("teamId");
  const limit = parseLimit(searchParams);

  if (!userId) {
    return NextResponse.json({ error: "userId query param is required" }, { status: 400 });
  }

  try {
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (scope === "personal") {
      const rewards = await getRewardsByUserId(user.id);
      return NextResponse.json({ scope, entries: buildWinLogFromRewards(rewards ? [rewards] : [], limit) });
    }

    if (scope === "team") {
      if (!isManager(user)) {
        return NextResponse.json({ error: "Team scope is available to managers only" }, { status: 403 });
      }

      const teamIds = getAccessibleTeamIds(user);
      const targetTeam = teamId && teamIds.includes(teamId) ? teamId : teamIds[0];
      if (!targetTeam) {
        return NextResponse.json({ error: "No teams assigned" }, { status: 403 });
      }

      const members = await fetchTeamMembers(targetTeam);
      const rewardsDocs = await fetchRewardsForUsers(members.map((member) => member.id));
      const entries = buildWinLogFromRewards(rewardsDocs, limit).map((entry) => ({
        ...entry,
        userName: members.find((member) => member.id === entry.userId)?.name || null,
      }));

      return NextResponse.json({ scope, teamId: targetTeam, entries });
    }

    if (scope === "org") {
      const { resources } = await containers.rewards.items.query("SELECT * FROM c").fetchAll();
      const entries = buildWinLogFromRewards(resources || [], limit);
      return NextResponse.json({ scope, entries });
    }

    return NextResponse.json({ error: "Unsupported scope" }, { status: 400 });
  } catch (error) {
    console.error("[API analytics wins]", error);
    return NextResponse.json({ error: "Failed to load win log" }, { status: 500 });
  }
}
