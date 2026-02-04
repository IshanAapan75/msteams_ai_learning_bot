const { containers } = require("./cosmos.js");
const {
  appendLearningAction,
  fetchResponseProgress,
  getLearningEntry,
  updateLearningEntry,
  upsertLearningEntry,
  saveResponseProgress,
} = require("./learningProgress.js");

const COOLDOWN_MS = 0; // Immediate availability forced

const nowIso = () => new Date().toISOString();

function computeLearningStartTimestamp(base = Date.now()) {
  return new Date(base).toISOString(); // Force to 0 delay
}

function maxTimestampIso(firstIso, secondIso) {
  const first = firstIso ? new Date(firstIso).getTime() : null;
  const second = secondIso ? new Date(secondIso).getTime() : null;
  const candidate = Math.max(first ?? -Infinity, second ?? -Infinity);
  if (!Number.isFinite(candidate)) {
    return null;
  }
  return new Date(candidate).toISOString();
}

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
  const sorted = [...modules].sort((a, b) => {
    const orderA = normalizeOrder(a.day ?? a.order ?? a.position ?? a.sequence, Number.MAX_SAFE_INTEGER);
    const orderB = normalizeOrder(b.day ?? b.order ?? b.position ?? b.sequence, Number.MAX_SAFE_INTEGER);
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
  return sorted;
}

async function fetchLearningCatalog(userId) {
  const { resources } = await containers.ai_learning.items.readAll().fetchAll();
  return sortCatalog(resources || []);
}

function isSurveyComplete(entry) {
  return Boolean(entry?.surveyCompletedAt);
}

function formatAssignment(module, entry, overrideCanStart = null) {
  if (!module || !entry) {
    return null;
  }

  const availableAt = entry.availableAt || nowIso();
  const derivedStatus = !entry.completedAt
    ? entry.status || "available"
    : entry.quizPassedAt && !entry.surveyCompletedAt
    ? "awaiting_survey"
    : entry.status || "completed";

  const canStart = true; // Always true for 0 cooldown

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
      tier: module.tier,
      rewards: module.rewards,
      quizzes: Array.isArray(module.quizzes) ? module.quizzes : [],
    },
  };
}

async function syncLearningAssignment(userId, forceResync = false) {
  if (!userId) {
    return { assignment: null, status: "missing-user" };
  }

  const catalog = await fetchLearningCatalog(userId);
  const progress = await fetchResponseProgress(userId);
  
  if (!progress.learnings || progress.learnings.length === 0) {
      return { assignment: null, status: "none" };
  }

  let targetModule = null;
  let entry = null;

  const now = Date.now();
  const availableLearnings = progress.learnings
    .filter(le => le.status === "available")
    .sort((a, b) => {
      const moduleA = catalog.find(m => m.id === a.learningId);
      const moduleB = catalog.find(m => m.id === b.learningId);
      const valA = normalizeOrder(moduleA?.day ?? moduleA?.order, Infinity);
      const valB = normalizeOrder(moduleB?.day ?? moduleB?.order, Infinity);
      return valA - valB;
    });

  if (availableLearnings.length > 0) {
    const firstAvailable = availableLearnings[0];
    targetModule = catalog.find(m => m.id === firstAvailable.learningId);
    entry = firstAvailable;
  }

  if (!targetModule || !entry) {
    return { assignment: null, status: "completed" };
  }

  // Force reset availableAt to now
  entry.availableAt = nowIso();
  entry.updatedAt = nowIso();
  await saveResponseProgress(progress);

  return {
    assignment: formatAssignment(targetModule, entry),
    status: entry.status || "available",
  };
}

async function recordQuizResult({ userId, learningId, result, completedAt }) {
  if (!userId || !learningId) {
    return { entry: null, nextAssignment: null };
  }

  const userResponse = await fetchResponseProgress(userId);
  const entry = getLearningEntry(userResponse, learningId);

  if (!entry) throw new Error("Learning entry not found");

  const updates = {
    lastQuizResult: result,
    status: "completed",
    completedAt: completedAt || nowIso()
  };

  if (result === "passed") {
    updates.quizPassedAt = updates.completedAt;
  }

  Object.assign(entry, updates);
  
  let nextAssignment = null;
  const attemptCount = entry.attempts ? entry.attempts.length : 0;

  // ONLY assign next if passed OR 2nd attempt is reached
  if (result === "passed" || attemptCount >= 2) {
      const assignedNext = await assignNextLearning(userId, learningId, userResponse);
      if (assignedNext) {
          nextAssignment = formatAssignment(assignedNext.module, assignedNext.entry);
      }
  }

  await saveResponseProgress(userResponse);

  return { entry, nextAssignment };
}

async function assignNextLearning(userId, finishedLearningId, userResponse) {
  const catalog = await fetchLearningCatalog(userId);
  let shouldAssignNext = false;

  for (const module of catalog) {
    if (module.id === finishedLearningId) {
      shouldAssignNext = true;
      continue;
    }
    if (!shouldAssignNext) continue;

    let entry = getLearningEntry(userResponse, module.id);
    if (!entry) {
        entry = {
            learningId: module.id,
            status: "available",
            attempts: [],
            createdAt: nowIso(),
            updatedAt: nowIso(),
        };
        userResponse.learnings.push(entry);
    }
    
    entry.assignedAt = nowIso();
    entry.availableAt = nowIso();
    entry.status = "available";

    return { module, entry };
  }
  return null;
}

module.exports = {
    COOLDOWN_MS,
    syncLearningAssignment,
    recordQuizResult,
    fetchLearningCatalog,
    recordSurveyAndAssignNext: async ({ userId, learningId, survey }) => {
        await appendLearningAction({ userId, learningId, action: { type: "ai_usage", ...survey } });
        const { entry } = await updateLearningEntry(userId, learningId, { surveyCompletedAt: nowIso() });
        return { finishedEntry: entry, nextAssignment: null };
    }
};