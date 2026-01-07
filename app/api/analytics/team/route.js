import { NextResponse } from "next/server";
import {
  aggregateTeamStats,
  fetchRewardsForUsers,
  fetchTeamMembers,
  getAccessibleTeamIds,
  getTeamById,
  getUserById,
  isManager,
} from "../../../../lib/analytics";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const teamId = searchParams.get("teamId");

  if (!userId) {
    return NextResponse.json({ error: "userId query param is required" }, { status: 400 });
  }

  try {
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // if (!isManager(user)) {
    //   return NextResponse.json({ error: "Team analytics is available to managers only" }, { status: 403 });
    // }

    const accessibleTeams = getAccessibleTeamIds(user);
    if (!accessibleTeams.length) {
      return NextResponse.json({ error: "No teams assigned to this manager" }, { status: 403 });
    }

    const resolvedTeamId = teamId && accessibleTeams.includes(teamId) ? teamId : accessibleTeams[0];
    const team = await getTeamById(resolvedTeamId);
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const members = await fetchTeamMembers(resolvedTeamId);
    const rewardsDocs = await fetchRewardsForUsers(members.map((member) => member.id));
    const stats = aggregateTeamStats(members, rewardsDocs);

    const memberRecords = members.map((member) => {
      const reward = rewardsDocs.find((doc) => doc?.id === member.id);
      return {
        id: member.id,
        name: member.name,
        xp: reward?.xp || 0,
        streak: reward?.streak || 0,
        lastActionDate: reward?.lastActionDate || null,
      };
    });

    return NextResponse.json({
      team: {
        id: team.id,
        name: team.name,
        score: team.score || stats.totalXp,
        ...stats,
      },
      members: memberRecords,
      accessibleTeams,
    });
  } catch (error) {
    console.error("[API analytics team]", error);
    return NextResponse.json({ error: "Failed to load team analytics" }, { status: 500 });
  }
}
