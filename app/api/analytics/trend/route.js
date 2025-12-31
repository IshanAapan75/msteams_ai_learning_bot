import { NextResponse } from "next/server";
import {
  buildTrendSeries,
  fetchRewardsForUsers,
  fetchTeamMembers,
  getAccessibleTeamIds,
  getRewardsByUserId,
  getUserById,
  mergeDailyTotals,
} from "../../../../lib/analytics";
import { containers } from "../../../../lib/cosmos";

function parseRange(searchParams) {
  const value = Number(searchParams.get("range"));
  if (!Number.isFinite(value) || value <= 0) {
    return 30;
  }
  return Math.min(180, Math.max(7, Math.round(value)));
}

async function resolveRewards({ user, scope, targetTeamId }) {
  if (scope === "org") {
    const { resources } = await containers.rewards.items
      .query("SELECT * FROM c")
      .fetchAll();
    return resources || [];
  }

  if (scope === "team") {
    const teamIds = getAccessibleTeamIds(user);
    const selectedTeamId = targetTeamId || teamIds[0];

    if (!selectedTeamId || !teamIds.includes(selectedTeamId)) {
      throw new Error("You do not have access to this team");
    }

    const teamMembers = await fetchTeamMembers(selectedTeamId);
    const rewardsDocs = await fetchRewardsForUsers(teamMembers.map((member) => member.id));
    return rewardsDocs;
  }

  const rewards = await getRewardsByUserId(user.id);
  return rewards ? [rewards] : [];
}

function resolveScope(searchParams) {
  const scope = (searchParams.get("scope") || "personal").toLowerCase();
  if (["personal", "team", "org"].includes(scope)) {
    return scope;
  }
  return "personal";
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const scope = resolveScope(searchParams);
  const rangeDays = parseRange(searchParams);
  const teamId = searchParams.get("teamId");

  if (!userId) {
    return NextResponse.json({ error: "userId query param is required" }, { status: 400 });
  }

  try {
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const rewardsDocs = await resolveRewards({ user, scope, targetTeamId: teamId });
    const dailyTotalsMap = scope === "personal"
      ? rewardsDocs[0]?.dailyTotals || {}
      : mergeDailyTotals(rewardsDocs);

    const series = buildTrendSeries(dailyTotalsMap, rangeDays);

    return NextResponse.json({ scope, rangeDays, series });
  } catch (error) {
    console.error("[API analytics trend]", error);
    return NextResponse.json({ error: "Failed to load trend data" }, { status: 500 });
  }
}
