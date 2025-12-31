import { containers } from "./cosmos.js";

const ACTIONS = {
  "micro-learning": {
    xp: 5,
    awardedBy: "ai learnings",
  },
  "micro-assessment": {
    xp: 5,
    awardedBy: "quiz",
  },
  "micro-action": {
    xp: 10,
    awardedBy: "i tried this",
  },
  "ai-usage": {
    xp: 10,
    awardedBy: "ai usage",
  },
};

const STREAK_MULTIPLIERS = [
  { min: 1, max: 2, multiplier: 1.0 },
  { min: 3, max: 6, multiplier: 1.1 },
  { min: 7, max: 13, multiplier: 1.2 },
  { min: 14, max: Infinity, multiplier: 1.3 },
];

const DAILY_WINDOW = 35;
const METADATA_WINDOW = 100;
const FLUENCY_COMPONENT_LIMITS = {
  assessments: 35,
  usage: 25,
  quality: 20,
  confidence: 10,
  consistency: 10,
};

const DEFAULT_FLUENCY_COMPONENTS = {
  assessments: 0,
  usage: 0,
  quality: 0,
  confidence: 0,
  consistency: 0,
};

const DEFAULT_REWARD_RECORD = (userId) => ({
  id: userId,
  userId,
  xp: 0,
  fluency: 0,
  streak: 0,
  lastActionDate: null,
  dailyTotals: {},
  metadata: [],
  badges: [],
  tier: "AI Rookie",
  fluencyComponents: { ...DEFAULT_FLUENCY_COMPONENTS },
  updatedAt: new Date().toISOString(),
});

const XP_THRESHOLDS = [
  { tier: "AI Explorer", min: 1500 },
  { tier: "AI Learner", min: 500 },
  { tier: "AI Rookie", min: 0 },
];

function toDateString(date = new Date()) {
  return new Date(date).toISOString().split("T")[0];
}

function isWeekend(date) {
  const day = new Date(date).getUTCDay();
  return day === 0 || day === 6;
}

function computeWorkingDayGap(previousDate, currentDate) {
  if (!previousDate) return 0;
  const prev = new Date(previousDate);
  const curr = new Date(currentDate);
  if (curr <= prev) return 0;

  let gap = 0;
  const iterator = new Date(prev);
  iterator.setUTCDate(iterator.getUTCDate() + 1);

  while (iterator < curr) {
    if (!isWeekend(iterator)) {
      gap += 1;
    }
    iterator.setUTCDate(iterator.getUTCDate() + 1);
  }

  return gap;
}

function getMultiplier(streakLength) {
  const entry = STREAK_MULTIPLIERS.find((range) => streakLength >= range.min && streakLength <= range.max);
  return entry ? entry.multiplier : 1;
}

function clampMetadata(metadata) {
  if (!Array.isArray(metadata)) return [];
  if (metadata.length <= METADATA_WINDOW) return metadata;
  return metadata.slice(metadata.length - METADATA_WINDOW);
}

function pruneDailyTotals(dailyTotals) {
  const entries = Object.entries(dailyTotals || {});
  if (entries.length <= DAILY_WINDOW) {
    return dailyTotals || {};
  }
  const sorted = entries.sort(([dateA], [dateB]) => (dateA < dateB ? -1 : 1));
  const trimmed = sorted.slice(sorted.length - DAILY_WINDOW);
  return trimmed.reduce((acc, [date, value]) => {
    acc[date] = value;
    return acc;
  }, {});
}

function normalizeFluencyComponents(components = {}) {
  const normalized = { ...DEFAULT_FLUENCY_COMPONENTS, ...(components || {}) };
  for (const key of Object.keys(DEFAULT_FLUENCY_COMPONENTS)) {
    normalized[key] = Math.min(
      FLUENCY_COMPONENT_LIMITS[key],
      Math.max(0, Number(normalized[key]) || 0)
    );
  }
  return normalized;
}

function calculateFluencyScore(components) {
  return Object.values(components).reduce((acc, value) => acc + value, 0);
}

async function loadRewardRecord(userId) {
  try {
    const { resource } = await containers.rewards.item(userId, userId).read();
    if (!resource) {
      return DEFAULT_REWARD_RECORD(userId);
    }
    resource.dailyTotals = resource.dailyTotals || {};
    resource.metadata = resource.metadata || [];
    resource.badges = resource.badges || [];
    resource.fluencyComponents = normalizeFluencyComponents(resource.fluencyComponents);
    resource.tier = resource.tier || "AI Rookie";
    return resource;
  } catch (error) {
    if (error.code === 404) {
      return DEFAULT_REWARD_RECORD(userId);
    }
    throw error;
  }
}

function updateStreak(reward, actionDate) {
  const actionDay = toDateString(actionDate);
  const lastActionDay = reward.lastActionDate;

  if (lastActionDay === actionDay) {
    return reward.streak || 1;
  }

  const gap = computeWorkingDayGap(lastActionDay, actionDay);

  if (gap > 0) {
    reward.streak = 1;
  } else {
    reward.streak = (reward.streak || 0) + 1;
  }

  reward.lastActionDate = actionDay;
  return reward.streak;
}

function updateDailyTotals(reward, dateString, xpBase) {
  const existing = reward.dailyTotals[dateString] || { xpBase: 0, multiplier: 1, xpAwarded: 0 };
  existing.xpBase += xpBase;
  existing.multiplier = getMultiplier(reward.streak || 1);
  const newXpAwarded = Math.round(existing.xpBase * existing.multiplier);
  const xpDelta = newXpAwarded - (existing.xpAwarded || 0);
  existing.xpAwarded = newXpAwarded;
  reward.dailyTotals[dateString] = existing;
  reward.dailyTotals = pruneDailyTotals(reward.dailyTotals);
  return { xpDelta, snapshot: existing };
}

function updateMetadata(reward, entry) {
  reward.metadata = clampMetadata([...(reward.metadata || []), entry]);
}

function updateFluency(reward, actionType, options = {}) {
  const components = normalizeFluencyComponents(reward.fluencyComponents);

  switch (actionType) {
    case "micro-assessment":
      components.assessments = Math.min(
        FLUENCY_COMPONENT_LIMITS.assessments,
        components.assessments + 1
      );
      if (options.correctAnswers && options.totalQuestions) {
        const accuracy = options.correctAnswers / options.totalQuestions;
        components.quality = Math.min(
          FLUENCY_COMPONENT_LIMITS.quality,
          components.quality + Math.round(accuracy * 2)
        );
      }
      break;
    case "micro-learning":
      components.consistency = Math.min(
        FLUENCY_COMPONENT_LIMITS.consistency,
        components.consistency + 1
      );
      components.confidence = Math.min(
        FLUENCY_COMPONENT_LIMITS.confidence,
        components.confidence + 1
      );
      break;
    case "ai-usage":
      components.usage = Math.min(
        FLUENCY_COMPONENT_LIMITS.usage,
        components.usage + 1
      );
      break;
    case "micro-action":
      components.quality = Math.min(
        FLUENCY_COMPONENT_LIMITS.quality,
        components.quality + 1
      );
      break;
    default:
      break;
  }

  reward.fluencyComponents = components;
  reward.fluency = calculateFluencyScore(components);
}

function determineTier(xp) {
  const entry = XP_THRESHOLDS.find((threshold) => xp >= threshold.min);
  return entry ? entry.tier : "AI Rookie";
}

export async function awardXpAction({
  userId,
  actionType,
  actionDate = new Date(),
  metadata = {},
  badges,
  fluencyOptions,
}) {
  if (!userId) {
    throw new Error("userId is required to award XP");
  }
  if (!ACTIONS[actionType]) {
    throw new Error(`Unsupported action type: ${actionType}`);
  }

  const reward = await loadRewardRecord(userId);
  const actionConfig = ACTIONS[actionType];
  const actionDay = toDateString(actionDate);

  const streakLength = updateStreak(reward, actionDate);
  const { xpDelta, snapshot } = updateDailyTotals(reward, actionDay, actionConfig.xp);

  reward.xp = (Number(reward.xp) || 0) + xpDelta;
  reward.tier = determineTier(reward.xp);

  updateFluency(reward, actionType, fluencyOptions);

  updateMetadata(reward, {
    awardedBy: actionConfig.awardedBy,
    awarded: metadata.awarded || "xp",
    value: actionConfig.xp,
    streak: streakLength,
    multiplier: snapshot.multiplier,
    timestamp: new Date(actionDate).toISOString(),
    details: metadata.details || null,
    day: actionDay,
  });

  if (Array.isArray(badges)) {
    reward.badges = badges;
  }

  reward.updatedAt = new Date().toISOString();

  const { resource } = await containers.rewards.items.upsert(reward);
  return {
    reward: resource,
    xpDelta,
    streak: streakLength,
    multiplier: snapshot.multiplier,
  };
}

export async function syncRewardBadges(userId, badges) {
  if (!userId || !Array.isArray(badges)) return null;
  const reward = await loadRewardRecord(userId);
  reward.badges = badges;
  reward.updatedAt = new Date().toISOString();
  const { resource } = await containers.rewards.items.upsert(reward);
  return resource;
}

