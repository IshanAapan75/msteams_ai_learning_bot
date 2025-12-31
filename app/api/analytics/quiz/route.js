import { NextResponse } from "next/server";
import {
  fetchResponsesForUsers,
  fetchTeamMembers,
  getAccessibleTeamIds,
  getResponsesByUserId,
  getUserById,
  isManager,
  summarizeQuizAttempts,
} from "../../../../lib/analytics";
import { containers } from "../../../../lib/cosmos";

function resolveScope(searchParams) {
  const scope = (searchParams.get("scope") || "personal").toLowerCase();
  if (["personal", "team", "org"].includes(scope)) {
    return scope;
  }
  return "personal";
}

function mapAttempts(attempts = [], users = []) {
  const usersMap = users.reduce((acc, user) => {
    acc[user.id] = user.name;
    return acc;
  }, {});

  return attempts.slice(0, 20).map((attempt) => ({
    quizId: attempt.quizId,
    userId: attempt.userId || null,
    userName: attempt.userId ? usersMap[attempt.userId] || null : null,
    result: attempt.result,
    status: attempt.status,
    submittedAt: attempt.submittedAt,
    score: attempt.score,
  }));
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
      const responses = await getResponsesByUserId(user.id);
      const { summary, latestAttempts } = summarizeFromResponses(responses, user);
      return NextResponse.json({ scope, ...summary, latestAttempts: mapAttempts(latestAttempts, [user]) });
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
      const aggregate = responsesDocs.flatMap(extractAttemptsWithUser);
      const { summary, latestAttempts } = summarizeFromAttempts(aggregate);

      return NextResponse.json({ scope, teamId: targetTeam, ...summary, latestAttempts: mapAttempts(latestAttempts, members) });
    }

    if (scope === "org") {
      const { resources } = await containers.responses.items.query("SELECT * FROM c").fetchAll();
      const aggregate = (resources || []).flatMap(extractAttemptsWithUser);
      const { summary, latestAttempts } = summarizeFromAttempts(aggregate);

      return NextResponse.json({ scope, ...summary, latestAttempts: mapAttempts(latestAttempts) });
    }

    return NextResponse.json({ error: "Unsupported scope" }, { status: 400 });
  } catch (error) {
    console.error("[API analytics quiz]", error);
    return NextResponse.json({ error: "Failed to load quiz analytics" }, { status: 500 });
  }
}

function summarizeFromResponses(responsesDoc, user) {
  const attempts = extractAttemptsWithUser(responsesDoc, user?.id);
  return summarizeFromAttempts(attempts);
}

function summarizeFromAttempts(attempts = []) {
  const { attempts: totalAttempts, passed, passRate, avgScore, latestAttempts } = summarizeQuizAttempts([
    { attempts },
  ]);
  return {
    summary: { attempts: totalAttempts, passed, passRate, avgScore },
    latestAttempts: latestAttempts.map((attempt) => ({
      ...attempt,
      userId: attempt.userId || null,
    })),
  };
}

function extractAttemptsWithUser(doc, fallbackUserId) {
  if (!doc) {
    return [];
  }

  const userId = doc.userId || doc.id || fallbackUserId;
  const learnings = Array.isArray(doc.learnings) ? doc.learnings : [];
  return learnings.flatMap((entry) => {
    const attempts = Array.isArray(entry.attempts) ? entry.attempts : [];
    return attempts.map((attempt) => ({ ...attempt, userId }));
  });
}
