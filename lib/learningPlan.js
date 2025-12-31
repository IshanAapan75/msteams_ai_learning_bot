import { containers } from "./cosmos.js";
import {
  appendLearningAction,
  fetchResponseProgress,
  getLearningEntry,
  updateLearningEntry,
  upsertLearningEntry,
} from "./learningProgress.js";

const COOLDOWN_HOURS = Number(process.env.AI_LEARNING_COOLDOWN_HOURS || 18);
const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;

const nowIso = () => new Date().toISOString();

function toDate(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeOrder(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function sortCatalog(modules = []) {
  return [...modules].sort((a, b) => {
    const orderA = normalizeOrder(a.order ?? a.position ?? a.sequence, Number.MAX_SAFE_INTEGER);
    const orderB = normalizeOrder(b.order ?? b.position ?? b.sequence, Number.MAX_SAFE_INTEGER);
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    const createdA = toDate(a.createdAt)?.getTime() ?? 0;
    const createdB = toDate(b.createdAt)?.getTime() ?? 0;
    if (createdA !== createdB) {
      return createdA - createdB;
    }

    const topicA = (a.topic || a.title || "").toLowerCase();
    const topicB = (b.topic || b.title || "").toLowerCase();
    return topicA.localeCompare(topicB);
  });
}

async function fetchLearningCatalog(userId) {
  let resources;
  if (userId) {
    const { resources: filtered } = await containers.ai_learning.items
      .query({
        query: "SELECT * FROM c WHERE NOT IS_DEFINED(c.userId) OR c.userId = @userId",
        parameters: [{ name: "@userId", value: userId }],
      })
      .fetchAll();
    resources = filtered;
  } else {
    const { resources: all } = await containers.ai_learning.items.readAll().fetchAll();
    resources = all;
  }
  return sortCatalog(resources || []);
}

function isSurveyComplete(entry) {
  return Boolean(entry?.surveyCompletedAt);
}

function formatAssignment(module, entry, overrideCanStart = null) {
  if (!module || !entry) {
    return null;
  }

  const availableAt = entry.availableAt || entry.cooldownEndsAt || null;
  const derivedStatus = !entry.completedAt
    ? entry.status || "assigned"
    : entry.quizPassedAt && !entry.surveyCompletedAt
    ? "awaiting_survey"
    : entry.status || "completed";

  const canStart =
    typeof overrideCanStart === "boolean"
      ? overrideCanStart
      : derivedStatus === "awaiting_survey"
      ? false
      : !availableAt || toDate(availableAt)?.getTime() <= Date.now();

  return {
    learningId: module.id,
    status: derivedStatus,
    availableAt,
    assignedAt: entry.assignedAt || null,
    completedAt: entry.completedAt || null,
    quizPassedAt: entry.quizPassedAt || null,
    surveyCompletedAt: entry.surveyCompletedAt || null,
    canStart,
    module: {
      id: module.id,
      topic: module.topic,
      title: module.title || module.topic,
      description: module.description,
      details: module.details,
      level: module.level,
      rewards: module.rewards,
      quizzes: Array.isArray(module.quizzes) ? module.quizzes : [],
    },
  };
}

async function ensureEntry(userId, learningId, desiredStatus = "assigned") {
  await upsertLearningEntry({ userId, learningId, status: desiredStatus });
  const refreshed = await fetchResponseProgress(userId);
  return getLearningEntry(refreshed, learningId);
}

export async function syncLearningAssignment(userId, forceResync = false) {
  if (!userId) {
    return { assignment: null, status: "missing-user" };
  }

  const catalog = await fetchLearningCatalog(userId);
  if (!catalog.length) {
    return { assignment: null, status: "no-modules" };
  }

  const progress = forceResync ? await fetchResponseProgress(userId) : await fetchResponseProgress(userId);
  let targetModule = null;
  let entry = null;

  for (const module of catalog) {
    const existing = getLearningEntry(progress, module.id);
    if (!existing || !isSurveyComplete(existing)) {
      targetModule = module;
      entry = existing;
      break;
    }
  }

  if (!targetModule) {
    return { assignment: null, status: "completed" };
  }

  if (!entry) {
    entry = await ensureEntry(userId, targetModule.id, "assigned");
  }

  const updates = {};
  if (!entry.assignedAt) {
    updates.assignedAt = nowIso();
  }
  if (!entry.availableAt) {
    updates.availableAt = entry.cooldownEndsAt || updates.assignedAt || nowIso();
  }

  let latestEntry = entry;
  if (Object.keys(updates).length > 0) {
    const { entry: updatedEntry } = await updateLearningEntry(userId, targetModule.id, updates);
    latestEntry = updatedEntry;
  }

  return {
    assignment: formatAssignment(targetModule, latestEntry),
    status: latestEntry.status || "assigned",
  };
}

async function assertLearningAvailable(userId, learningId) {
  const progress = await fetchResponseProgress(userId);
  const entry = getLearningEntry(progress, learningId);
  if (!entry) {
    const error = new Error("Learning module is not assigned to user");
    error.code = "LEARNING_NOT_ASSIGNED";
    throw error;
  }

  if (entry.availableAt) {
    const availableAt = toDate(entry.availableAt);
    if (availableAt && availableAt.getTime() > Date.now()) {
      const error = new Error("Learning module is locked until cooldown expires");
      error.code = "LEARNING_LOCKED";
      error.availableAt = availableAt.toISOString();
      throw error;
    }
  }

  return entry;
}

export async function markLearningCompleted(userId, learningId) {
  await assertLearningAvailable(userId, learningId);
  const { entry } = await updateLearningEntry(userId, learningId, {
    status: "completed",
    completedAt: nowIso(),
  });
  return entry;
}

export async function recordQuizResult({ userId, learningId, result }) {
  if (!userId || !learningId) {
    return null;
  }

  const updates = {
    lastQuizResult: result,
  };

  if (result === "passed") {
    updates.quizPassedAt = nowIso();
  }

  const { entry } = await updateLearningEntry(userId, learningId, updates);
  return entry;
}

async function assignNextLearning(userId, finishedLearningId) {
  const catalog = await fetchLearningCatalog(userId);
  let shouldAssignNext = false;

  for (const module of catalog) {
    if (module.id === finishedLearningId) {
      shouldAssignNext = true;
      continue;
    }

    if (!shouldAssignNext) {
      continue;
    }

    const entry = await ensureEntry(userId, module.id, "assigned");
    if (isSurveyComplete(entry)) {
      continue;
    }

    const cooldownUntil = new Date(Date.now() + COOLDOWN_MS).toISOString();
    const { entry: updatedEntry } = await updateLearningEntry(userId, module.id, {
      assignedAt: nowIso(),
      availableAt: cooldownUntil,
      cooldownEndsAt: cooldownUntil,
      status: entry.status || "assigned",
    });

    return {
      module,
      entry: updatedEntry,
      cooldownUntil,
    };
  }

  return null;
}

export async function recordSurveyAndAssignNext({ userId, learningId, survey }) {
  if (!userId || !learningId) {
    return { nextAssignment: null };
  }

  await appendLearningAction({
    userId,
    learningId,
    action: {
      type: "ai_usage",
      ...survey,
    },
  });

  const { entry } = await updateLearningEntry(userId, learningId, {
    surveyCompletedAt: nowIso(),
  });

  const next = await assignNextLearning(userId, learningId);

  return {
    finishedEntry: entry,
    nextAssignment: next ? formatAssignment(next.module, next.entry, false) : null,
  };
}
