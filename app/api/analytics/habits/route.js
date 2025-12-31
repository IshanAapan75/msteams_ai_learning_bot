import { NextResponse } from "next/server";
import {
  aggregateFluencyComponents,
  extractFluencyComponents,
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

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const scope = resolveScope(searchParams);
  const teamId = searchParams.get("teamId");

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
      return NextResponse.json({ scope, components: extractFluencyComponents(rewards) });
    }

    if (scope === "team") {
      if (!isManager(user)) {
        return NextResponse.json({ error: "Team scope is available to managers only" }, { status: 403 });
      }

      const teamIds = getAccessibleTeamIds(user);
      const targetTeam = teamId && teamIds.includes(teamId) ? teamId : teamIds[0];
      if (!targetTeam) {
        return NextResponse.json({ error: "No teams assigned to this user" }, { status: 403 });
      }

      const teamMembers = await fetchTeamMembers(targetTeam);
      const rewardsDocs = await fetchRewardsForUsers(teamMembers.map((member) => member.id));

      return NextResponse.json({ scope, teamId: targetTeam, components: aggregateFluencyComponents(rewardsDocs) });
    }

    if (scope === "org") {
      const { resources } = await containers.rewards.items.query("SELECT * FROM c").fetchAll();
      return NextResponse.json({ scope, components: aggregateFluencyComponents(resources || []) });
    }

    return NextResponse.json({ error: "Unsupported scope" }, { status: 400 });
  } catch (error) {
    console.error("[API analytics habits]", error);
    return NextResponse.json({ error: "Failed to load habit metrics" }, { status: 500 });
  }
}
