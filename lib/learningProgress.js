const { containers } = require("./cosmos.js");

const DEFAULT_STATUS = "not started";
const nowIso = () => new Date().toISOString();

function normalizeAttempts(attempts) {
  if (!Array.isArray(attempts)) return [];
  return attempts.map((attempt) => {
      if (!attempt || typeof attempt !== "object") return null;
      const quizId = attempt.quizId || attempt.quiz_id || null;
      if (!quizId) return null;
      const responses = Array.isArray(attempt.responses) ? attempt.responses : [];
      let status = attempt.status || (responses.length ? "completed" : "pending");
      return {
        quizId,
        status,
        responses,
        score: attempt.score || null,
        result: attempt.result || null,
        xpEarned: typeof attempt.xpEarned === "number" ? attempt.xpEarned : attempt?.xp || 0,
        assignedAt: attempt.assignedAt || attempt.createdAt || nowIso(),
        startedAt: attempt.startedAt || null,
        submittedAt: attempt.submittedAt || null,
        completedAt: attempt.completedAt || (status === "completed" ? attempt.submittedAt || nowIso() : null),
        metadata: attempt.metadata || null,
      };
    }).filter(Boolean);
}

function migrateLegacyStructure(doc, userId) {
  if (!doc || typeof doc !== "object") return { id: userId, userId, learnings: [], updatedAt: nowIso() };
  const migrated = { ...doc };
  const preserveFields = ["availableAt", "assignedAt", "completedAt", "quizPassedAt", "survey", "actions", "module", "topic", "title", "description", "details", "level", "metadata"];

  if (!Array.isArray(migrated.learnings)) {
    migrated.learnings = [];
    if (migrated.aiLearningId) {
      migrated.learnings.push({
        learningId: "micro-learning-day-1", // Forced reset for legacy
        status: migrated.aiLearningStatus || DEFAULT_STATUS,
        attempts: normalizeAttempts(migrated.attempts),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }
  }
  return migrated;
}

async function fetchResponseProgress(userId) {
  if (!userId) return null;
  try {
    const { resource } = await containers.responses.item(userId, userId).read();
    if (resource) return migrateLegacyStructure(resource, userId);
  } catch (err) {}
  return { id: userId, userId, learnings: [], updatedAt: nowIso() };
}

async function saveResponseProgress(doc) {
  if (!doc || !doc.userId) return null;
  const payload = { ...doc, partitionKey: doc.userId, updatedAt: nowIso() };
  await containers.responses.items.upsert(payload);
  return payload;
}

function getLearningEntry(doc, learningId) {
  if (!doc || !Array.isArray(doc.learnings)) return null;
  return doc.learnings.find((e) => e.learningId === learningId) || null;
}

async function upsertLearningEntry({ userId, learningId, status, quizIds = [] }) {
  const doc = await fetchResponseProgress(userId);
  let entry = getLearningEntry(doc, learningId);
  if (!entry) {
    entry = { learningId, status: status || DEFAULT_STATUS, attempts: [], createdAt: nowIso() };
    doc.learnings.push(entry);
  }
  entry.status = status || entry.status;
  entry.updatedAt = nowIso();
  await saveResponseProgress(doc);
  return doc;
}

module.exports = {
  fetchResponseProgress,
  saveResponseProgress,
  getLearningEntry,
  upsertLearningEntry,
  updateLearningEntry: async (userId, learningId, updates) => {
      const doc = await fetchResponseProgress(userId);
      const entry = getLearningEntry(doc, learningId);
      if (entry) Object.assign(entry, updates);
      await saveResponseProgress(doc);
      return { doc, entry };
  },
  appendLearningAction: async ({ userId, learningId, action }) => {
      const doc = await fetchResponseProgress(userId);
      const entry = getLearningEntry(doc, learningId);
      if (entry) {
          entry.actions = entry.actions || [];
          entry.actions.push({ ...action, timestamp: nowIso() });
      }
      await saveResponseProgress(doc);
  },
  markQuizAttempt: async ({ userId, learningId, quizId, update }) => {
      const doc = await fetchResponseProgress(userId);
      const entry = getLearningEntry(doc, learningId);
      if (entry) {
          let attempt = entry.attempts.find(a => a.quizId === quizId);
          if (!attempt) { attempt = { quizId, status: "pending", responses: [], assignedAt: nowIso() }; entry.attempts.push(attempt); }
          Object.assign(attempt, update);
          await saveResponseProgress(doc);
      }
  }
};