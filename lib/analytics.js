import { containers } from "./cosmos.js";

const MANAGER_ROLES = ["manager", "team lead", "admin", "leader"];

async function safeReadItem(container, id) {
  if (!id) {
    return null;
  }

  try {
    const { resource } = await container.item(id, id).read();
    return resource || null;
  } catch (error) {
    if (error.code === 404) {
      return null;
    }
    throw error;
  }
}

export async function getUserById(userId) {
  return safeReadItem(containers.users, userId);
}

export async function getTeamById(teamId) {
  return safeReadItem(containers.teams, teamId);
}

export async function getRewardsByUserId(userId) {
  return safeReadItem(containers.rewards, userId);
}

export function isManager(user) {
  if (!user) {
    return false;
  }
  const role = (user.role || user.designation || "").toLowerCase();
  return MANAGER_ROLES.some((keyword) => role.includes(keyword));
}

export function getAccessibleTeamIds(user) {
  if (!user) {
    return [];
  }

  const managed = Array.isArray(user.managedTeams) ? user.managedTeams : [];
  const baseTeam = user.teamId ? [user.teamId] : [];

  if (isManager(user)) {
    return Array.from(new Set([...baseTeam, ...managed]));
  }

  // Individual contributors can only access their own team
  return baseTeam;
}

export function ensureTeamAccess(user, teamId) {
  if (!teamId) {
    throw new Error("teamId is required for team scoped analytics");
  }

  const allowed = getAccessibleTeamIds(user);
  if (!allowed.includes(teamId)) {
    throw new Error("You do not have access to this team");
  }
}

export async function fetchTeamMembers(teamId) {
  const query = {
    query: "SELECT c.id, c.name, c.teamId, c.role, c.designation FROM c WHERE c.teamId = @teamId",
    parameters: [{ name: "@teamId", value: teamId }],
  };

  const { resources } = await containers.users.items.query(query).fetchAll();
  return resources || [];
}

export async function fetchRewardsForUsers(userIds = []) {
  const results = await Promise.all(userIds.map((id) => getRewardsByUserId(id)));
  return results.filter(Boolean);
}

export function computeNextMilestone(totalXp = 0) {
  const normalizedXp = Number(totalXp) || 0;
  if (normalizedXp < 0) {
    return { nextMilestoneXp: 100, xpToNextMilestone: 100 }; 
  }

  const milestoneStep = 500;
  const currentBucket = Math.floor(normalizedXp / milestoneStep);
  const nextMilestoneXp = (currentBucket + 1) * milestoneStep;
  return {
    nextMilestoneXp,
    xpToNextMilestone: Math.max(0, nextMilestoneXp - normalizedXp),
  };
}

export function aggregateTeamStats(teamMembers = [], rewardsDocs = []) {
  if (!teamMembers.length || !rewardsDocs.length) {
    return {
      memberCount: teamMembers.length,
      totalXp: 0,
      avgStreak: 0,
      maxStreak: 0,
      lastActive: null,
    };
  }

  const totals = rewardsDocs.reduce(
    (acc, doc) => {
      const streak = Number(doc.streak) || 0;
      const xp = Number(doc.xp) || 0;
      const lastActionDate = doc.lastActionDate ? new Date(doc.lastActionDate) : null;

      acc.totalXp += xp;
      acc.totalStreak += streak;
      acc.maxStreak = Math.max(acc.maxStreak, streak);

      if (lastActionDate && (!acc.lastActive || lastActionDate > acc.lastActive)) {
        acc.lastActive = lastActionDate;
      }

      return acc;
    },
    { totalXp: 0, totalStreak: 0, maxStreak: 0, lastActive: null }
  );

  const memberCount = rewardsDocs.length;
  return {
    memberCount,
    totalXp: totals.totalXp,
    avgStreak: memberCount ? Number((totals.totalStreak / memberCount).toFixed(1)) : 0,
    maxStreak: totals.maxStreak,
    lastActive: totals.lastActive ? totals.lastActive.toISOString() : null,
  };
}

export async function aggregateOrgRewards() {
  const query = {
    query:
      "SELECT VALUE { totalXp: SUM(c.xp), avgStreak: AVG(c.streak), totalUsers: COUNT(1) } FROM c",
  };

  const { resources } = await containers.rewards.items.query(query).fetchAll();
  return resources?.[0] || { totalXp: 0, avgStreak: 0, totalUsers: 0 };
}

export function buildTrendSeries(dailyTotalsMap = {}, rangeDays = 30) {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - (rangeDays - 1));

  const result = [];
  for (let i = 0; i < rangeDays; i += 1) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);
    const key = current.toISOString().split("T")[0];
    const entry = dailyTotalsMap[key];
    const xp = entry?.xpAwarded ?? entry?.xpBase ?? 0;
    result.push({ date: key, xpEarned: Number(xp) || 0 });
  }

  return result;
}

export function mergeDailyTotals(rewardsDocs = []) {
  const aggregateMap = {};

  rewardsDocs.forEach((doc) => {
    const dailyTotals = doc?.dailyTotals || {};
    Object.entries(dailyTotals).forEach(([date, value]) => {
      const xp = value?.xpAwarded ?? value?.xpBase ?? 0;
      aggregateMap[date] = (aggregateMap[date] || 0) + Number(xp || 0);
    });
  });

  return Object.entries(aggregateMap).reduce((acc, [date, xp]) => {
    acc[date] = { xpAwarded: xp };
    return acc;
  }, {});
}

export async function getResponsesByUserId(userId) {
  return safeReadItem(containers.responses, userId);
}

export async function fetchResponsesForUsers(userIds = []) {
  const results = await Promise.all(userIds.map((id) => getResponsesByUserId(id)));
  return results.filter(Boolean);
}

export function summarizeLearningEntries(learnings = []) {
  const summary = {
    notStarted: 0,
    inProgress: 0,
    completed: 0,
  };
  const recentCompletions = [];

  learnings.forEach((entry) => {
    const status = (entry?.status || entry?.aiLearningStatus || "not started").toLowerCase();
    if (status.includes("progress")) {
      summary.inProgress += 1;
    } else if (status.includes("completed")) {
      summary.completed += 1;
      recentCompletions.push({
        learningId: entry.learningId,
        completedAt: entry.updatedAt || entry.completedAt || null,
      });
    } else {
      summary.notStarted += 1;
    }
  });

  recentCompletions.sort((a, b) => {
    const tsA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const tsB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return tsB - tsA;
  });

  return { summary, recentCompletions };
}

export function summarizeQuizAttempts(learnings = []) {
  let attempts = 0;
  let passed = 0;
  let totalScore = 0;
  let scoreCount = 0;
  const latest = [];

  learnings.forEach((entry) => {
    const quizAttempts = Array.isArray(entry.attempts) ? entry.attempts : [];
    quizAttempts.forEach((attempt) => {
      attempts += 1;
      const result = (attempt.result || "").toLowerCase();
      if (result.includes("pass")) {
        passed += 1;
      }

      if (attempt.score && typeof attempt.score.correct === "number" && typeof attempt.score.total === "number") {
        const percent = attempt.score.total ? (attempt.score.correct / attempt.score.total) * 100 : null;
        if (percent !== null) {
          totalScore += percent;
          scoreCount += 1;
        }
      }

      latest.push({
        quizId: attempt.quizId,
        status: attempt.status,
        result: attempt.result,
        submittedAt: attempt.submittedAt || attempt.completedAt || null,
        score: attempt.score || null,
      });
    });
  });

  latest.sort((a, b) => {
    const tsA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const tsB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return tsB - tsA;
  });

  const passRate = attempts ? Number(((passed / attempts) * 100).toFixed(1)) : 0;
  const avgScore = scoreCount ? Number((totalScore / scoreCount).toFixed(1)) : 0;

  return { attempts, passed, passRate, avgScore, latestAttempts: latest };
}

export function extractFluencyComponents(rewardsDoc) {
  const defaults = {
    assessments: 0,
    usage: 0,
    quality: 0,
    confidence: 0,
    consistency: 0,
  };

  if (!rewardsDoc || typeof rewardsDoc.fluencyComponents !== "object") {
    return defaults;
  }

  return {
    ...defaults,
    ...Object.keys(defaults).reduce((acc, key) => {
      acc[key] = Number(rewardsDoc.fluencyComponents?.[key] || 0);
      return acc;
    }, {}),
  };
}

export function aggregateFluencyComponents(rewardsDocs = []) {
  const totals = {
    assessments: 0,
    usage: 0,
    quality: 0,
    confidence: 0,
    consistency: 0,
  };

  rewardsDocs.forEach((doc) => {
    const components = extractFluencyComponents(doc);
    Object.keys(totals).forEach((key) => {
      totals[key] += components[key];
    });
  });

  const count = rewardsDocs.length || 1;
  const averages = Object.keys(totals).reduce((acc, key) => {
    acc[key] = Number((totals[key] / count).toFixed(1));
    return acc;
  }, {});

  return averages;
}

export function buildWinLogFromRewards(rewardsDocs = [], limit = 10) {
  const entries = [];

  rewardsDocs.forEach((doc) => {
    const metadataEntries = Array.isArray(doc?.metadata) ? doc.metadata : [];
    metadataEntries.forEach((item) => {
      entries.push({
        userId: doc.id,
        awardedBy: item.awardedBy || null,
        awarded: item.awarded || null,
        value: item.value || 0,
        streak: item.streak || doc.streak || 0,
        multiplier: item.multiplier || item.mult || 1,
        timestamp: item.timestamp || item.date || null,
        details: item.details || null,
      });
    });
  });

  entries.sort((a, b) => {
    const tsA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tsB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return tsB - tsA;
  });

  return entries.slice(0, limit);
}

