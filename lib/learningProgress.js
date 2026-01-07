import { containers } from "./cosmos.js";

const DEFAULT_STATUS = "not started";

const nowIso = () => new Date().toISOString();

function normalizeAttempts(attempts) {
  if (!Array.isArray(attempts)) {
    return [];
  }

  return attempts
    .map((attempt) => {
      if (!attempt || typeof attempt !== "object") {
        return null;
      }

      const quizId = attempt.quizId || attempt.quiz_id || null;
      if (!quizId) {
        return null;
      }

      const responses = Array.isArray(attempt.responses) ? attempt.responses : [];
      let status = attempt.status || (responses.length ? "completed" : "pending");
      if (!["pending", "in_progress", "completed"].includes(status)) {
        status = responses.length ? "completed" : "pending";
      }

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
    })
    .filter(Boolean);
}

function migrateLegacyStructure(doc, userId) {
  if (!doc || typeof doc !== "object") {
    return {
      id: userId,
      userId,
      learnings: [],
      updatedAt: nowIso(),
    };
  }

  const migrated = { ...doc };

  const preserveFields = [
    "availableAt",
    "assignedAt",
    "completedAt",
    "cooldownEndsAt",
    "quizAvailableAt",
    "usageAvailableAt",
    "quizPassedAt",
    "survey",
    "actions",
    "module",
    "topic",
    "title",
    "description",
    "details",
    "level",
    "metadata",
  ];

  if (!Array.isArray(migrated.learnings)) {
    migrated.learnings = [];

    if (migrated.aiLearningId) {
      const baseEntry = {
        learningId: migrated.aiLearningId,
        status: migrated.aiLearningStatus || DEFAULT_STATUS,
        attempts: normalizeAttempts(migrated.attempts),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      preserveFields.forEach((field) => {
        if (migrated[field] !== undefined) {
          baseEntry[field] = migrated[field];
        }
      });
      migrated.learnings.push(baseEntry);
    }
  } else {
    migrated.learnings = migrated.learnings
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const learningId = entry.learningId || entry.aiLearningId;
        if (!learningId) {
          return null;
        }
        const normalized = {
          learningId,
          status: entry.status || entry.aiLearningStatus || DEFAULT_STATUS,
          attempts: normalizeAttempts(entry.attempts),
          createdAt: entry.createdAt || nowIso(),
          updatedAt: entry.updatedAt || nowIso(),
        };
        preserveFields.forEach((field) => {
          if (entry[field] !== undefined) {
            normalized[field] = entry[field];
          }
        });
        return normalized;
      })
      .filter(Boolean);
  }

  delete migrated.aiLearningId;
  delete migrated.aiLearningStatus;
  delete migrated.attempts;

  if (!migrated.id) {
    migrated.id = userId;
  }

  if (!migrated.userId) {
    migrated.userId = userId;
  }

  if (!migrated.updatedAt) {
    migrated.updatedAt = nowIso();
  }

  return migrated;
}

export async function fetchResponseProgress(userId) {
  if (!userId) {
    return null;
  }

  let doc = null;
  try {
    const { resource } = await containers.responses.item(userId, userId).read();
    doc = resource;
  } catch (error) {
    if (error.code !== 404) {
      throw error;
    }
  }

  if (!doc) {
    try {
      const { resources } = await containers.responses.items
        .query({
          query: "SELECT * FROM c WHERE c.userId = @userId ORDER BY c._ts ASC",
          parameters: [{ name: "@userId", value: userId }],
        })
        .fetchAll();
      doc = resources?.[0] || null;
    } catch (queryError) {
      console.warn("[LearningProgress] Legacy response query failed", queryError);
    }
  }

  if (!doc) {
    return {
      id: userId,
      userId,
      learnings: [],
      updatedAt: nowIso(),
    };
  }

  return migrateLegacyStructure(doc, userId);
}

export async function saveResponseProgress(doc) {
  if (!doc || !doc.userId) {
    return null;
  }

  const payload = {
    ...doc,
    id: doc.id || doc.userId,
    userId: doc.userId,
    partitionKey: doc.userId,
    learnings: Array.isArray(doc.learnings) ? doc.learnings : [],
    updatedAt: nowIso(),
  };

  await containers.responses.items.upsert(payload);
  return payload;
}

function ensureLearningEntry(doc, learningId) {
  if (!learningId) {
    return null;
  }

  if (!Array.isArray(doc.learnings)) {
    doc.learnings = [];
  }

  let entry = doc.learnings.find((item) => item.learningId === learningId);

  if (!entry) {
    entry = {
      learningId,
      status: DEFAULT_STATUS,
      attempts: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    doc.learnings.push(entry);
  }

  if (!Array.isArray(entry.attempts)) {
    entry.attempts = [];
  }

  if (!entry.createdAt) {
    entry.createdAt = nowIso();
  }

  if (!entry.status) {
    entry.status = DEFAULT_STATUS;
  }

  return entry;
}

function uniqueQuizIds(quizIds = []) {
  const set = new Set();
  quizIds.forEach((id) => {
    if (id) {
      set.add(id);
    }
  });
  return Array.from(set);
}

export async function upsertLearningEntry({ userId, learningId, status, quizIds = [] }) {
  if (!userId || !learningId) {
    return null;
  }

  const normalizedStatus = status || DEFAULT_STATUS;
  const doc = await fetchResponseProgress(userId);
  const entry = ensureLearningEntry(doc, learningId);

  entry.status = normalizedStatus;
  entry.updatedAt = nowIso();

  if (normalizedStatus.toLowerCase() === "completed") {
    const quizzes = uniqueQuizIds(quizIds);
    quizzes.forEach((quizId) => {
      const existingAttempt = entry.attempts.find((attempt) => attempt.quizId === quizId);
      if (!existingAttempt) {
        entry.attempts.push({
          quizId,
          status: "pending",
          responses: [],
          assignedAt: nowIso(),
          startedAt: null,
          submittedAt: null,
          completedAt: null,
          score: null,
          result: null,
          xpEarned: 0,
        });
      }
    });
  }

  doc.updatedAt = entry.updatedAt;
  await saveResponseProgress(doc);
  return doc;
}

export async function updateLearningEntry(userId, learningId, updates = {}) {
  if (!userId || !learningId) {
    return null;
  }

  const doc = await fetchResponseProgress(userId);
  const entry = ensureLearningEntry(doc, learningId);

  Object.assign(entry, updates || {});
  entry.updatedAt = nowIso();
  doc.updatedAt = entry.updatedAt;

  await saveResponseProgress(doc);
  return { doc, entry };
}

export async function appendLearningAction({ userId, learningId, action }) {
  if (!userId || !learningId || !action) {
    return null;
  }

  const doc = await fetchResponseProgress(userId);
  const entry = ensureLearningEntry(doc, learningId);

  if (!Array.isArray(entry.actions)) {
    entry.actions = [];
  }

  entry.actions.push({
    ...action,
    timestamp: action.timestamp || nowIso(),
  });

  entry.updatedAt = nowIso();
  doc.updatedAt = entry.updatedAt;

  await saveResponseProgress(doc);
  return { doc, entry };
}

export function getLearningEntry(doc, learningId) {
  if (!doc || !Array.isArray(doc.learnings) || !learningId) {
    return null;
  }
  return doc.learnings.find((entry) => entry.learningId === learningId) || null;
}

export function getPendingAttempts(entry) {
  if (!entry || !Array.isArray(entry.attempts)) {
    return [];
  }
  return entry.attempts.filter((attempt) => attempt && attempt.status !== "completed");
}

export async function markQuizAttempt({
  userId,
  learningId,
  quizId,
  update = {},
}) {
  if (!userId || !learningId || !quizId) {
    return null;
  }

  const doc = await fetchResponseProgress(userId);
  const entry = ensureLearningEntry(doc, learningId);

  let attempt = entry.attempts.find((item) => item.quizId === quizId && item.status !== "completed");

  if (!attempt) {
    attempt = {
      quizId,
      status: "pending",
      responses: [],
      assignedAt: nowIso(),
      startedAt: null,
      submittedAt: null,
      completedAt: null,
      score: null,
      result: null,
      xpEarned: 0,
    };
    entry.attempts.push(attempt);
  }

  attempt.status = update.status || attempt.status || "pending";
  attempt.responses = Array.isArray(update.responses) ? update.responses : attempt.responses;
  attempt.score = update.score ?? attempt.score ?? null;
  attempt.result = update.result ?? attempt.result ?? null;
  attempt.xpEarned =
    typeof update.xpEarned === "number"
      ? update.xpEarned
      : typeof attempt.xpEarned === "number"
      ? attempt.xpEarned
      : 0;
  attempt.startedAt = update.startedAt || attempt.startedAt;
  attempt.submittedAt = update.submittedAt || attempt.submittedAt;
  attempt.completedAt = update.completedAt || (attempt.status === "completed" ? nowIso() : attempt.completedAt);
  attempt.metadata = update.metadata || attempt.metadata || null;

  entry.updatedAt = nowIso();
  doc.updatedAt = entry.updatedAt;

  await saveResponseProgress(doc);

  return {
    doc,
    entry,
    attempt,
  };
}

