import { NextResponse } from "next/server";
import {
  aggregateOrgRewards,
  computeNextMilestone,
  getRewardsByUserId,
  getUserById,
  isManager,
} from "../../../../lib/analytics";

function getScope(searchParams) {
  const scope = (searchParams.get("scope") || "personal").toLowerCase();
  if (["personal", "team", "org"].includes(scope)) {
    return scope;
  }
  return "personal";
}

function parseRange(searchParams) {
  const value = Number(searchParams.get("range"));
  if (!Number.isFinite(value) || value <= 0) {
    return 30;
  }
  return Math.min(180, Math.max(7, Math.round(value)));
}

function buildOverviewPayload({
  user,
  rewards,
  scope,
  rangeDays,
  orgSummary,
}) {
  const totalXp = rewards?.xp || 0;
  const streak = rewards?.streak || 0;
  const level = rewards?.level || user?.level || 1;

  const progress = computeNextMilestone(totalXp);

  return {
    scope,
    rangeDays,
    user: user
      ? {
          id: user.id,
          name: user.name,
          role: user.role || user.designation || "member",
          teamId: user.teamId || null,
        }
      : null,
    metrics: {
      totalXp,
      level,
      streak,
      fluencyScore: rewards?.fluency || user?.fluencyScore || 0,
      tier: rewards?.tier || "AI Rookie",
      badges: Array.isArray(rewards?.badges) ? rewards.badges.length : 0,
      lastActionDate: rewards?.lastActionDate || null,
      nextMilestoneXp: progress.nextMilestoneXp,
      xpToNextMilestone: progress.xpToNextMilestone,
    },
    org: orgSummary
      ? {
          totalXp: orgSummary.totalXp,
          avgStreak: Number(orgSummary.avgStreak || 0).toFixed(1),
          totalUsers: orgSummary.totalUsers,
        }
      : null,
  };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const scope = getScope(searchParams);
  const rangeDays = parseRange(searchParams);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId query param is required" }, { status: 400 });
  }

  try {
    const [user, rewards, orgSummary] = await Promise.all([
      getUserById(userId),
      getRewardsByUserId(userId),
      scope === "org" ? aggregateOrgRewards() : Promise.resolve(null),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (scope === "team" && !isManager(user)) {
      return NextResponse.json({ error: "Team scope is available to managers only" }, { status: 403 });
    }

    const payload = buildOverviewPayload({
      user,
      rewards,
      scope,
      rangeDays,
      orgSummary,
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[API analytics overview]", error);
    return NextResponse.json({ error: "Failed to load analytics overview" }, { status: 500 });
  }
}
