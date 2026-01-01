import { NextResponse } from "next/server";
import {
  fetchResponsesForUsers,
  fetchTeamMembers,
  getAccessibleTeamIds,
  getResponsesByUserId,
  getUserById,
  isManager,
  summarizeLearningEntries,
} from "../../../../lib/analytics";
import { containers } from "../../../../lib/cosmos.js";

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
      const userResponse = await getResponsesByUserId(user.id);
      const learnings = userResponse?.learnings || [];
      const { summary, recentCompletions } = summarizeLearningEntries(learnings);

      return NextResponse.json({
        scope,
        summary,
        recentCompletions,
        detailedLearnings: learnings, // New field for detailed learning progression
      });
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
      const responsesDocs = await fetchResponsesForUsers(members.map((member) => member.id));
      const aggregate = responsesDocs.flatMap((doc) => doc.learnings || []);
      const { summary, recentCompletions } = summarizeLearningEntries(aggregate);

      return NextResponse.json({ scope, teamId: targetTeam, summary, recentCompletions });
    }

    if (scope === "org") {
      const { resources } = await containers.responses.items.query("SELECT * FROM c").fetchAll();
      const aggregate = (resources || []).flatMap((doc) => doc.learnings || []);
      const { summary, recentCompletions } = summarizeLearningEntries(aggregate);
      return NextResponse.json({ scope, summary, recentCompletions: recentCompletions.slice(0, 25) });
    }

    return NextResponse.json({ error: "Unsupported scope" }, { status: 400 });
  } catch (error) {
    console.error("[API analytics learning]", error);
    return NextResponse.json({ error: "Failed to load learning metrics" }, { status: 500 });
  }
}

