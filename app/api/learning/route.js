const { containers } = require("../../../lib/cosmos.js");
const { NextResponse } = require("next/server");
const { awardXpAction } = require("../../../lib/rewards");
const { ensureUserHasProfile } = require("../../../lib/users.js");
const { upsertLearningEntry } = require("../../../lib/learningProgress");
const { recordSurveyAndAssignNext, syncLearningAssignment } = require("../../../lib/learningPlan.js");

async function upsertResponseStatus({ userId, microLearningId, status, quizzes = [] }) {
  if (!userId || !microLearningId) {
    return;
  }

  await upsertLearningEntry({
    userId,
    learningId: microLearningId,
    status,
    quizIds: quizzes,
  });
}

async function POST(req) {
  const learningModule = await req.json();

  if (!learningModule.status) {
    learningModule.status = "not started";
  }

  const { resource: createdModule } = await containers.micro_learning.items.create(learningModule);

  if (
    learningModule.userId &&
    typeof learningModule.status === "string" &&
    learningModule.status.toLowerCase() === "completed"
  ) {
    await upsertResponseStatus({
      userId: learningModule.userId,
      microLearningId: createdModule.id,
      status: "completed",
      quizzes: Array.isArray(learningModule.quizzes) ? learningModule.quizzes : [],
    });

    await awardXpAction({
      userId: learningModule.userId,
      actionType: "micro-learning",
      metadata: {
        details: {
          learningId: createdModule.id,
        },
      },
    });
  }

  return NextResponse.json(createdModule);
}

async function PATCH(req) {
  const payload = await req.json();
  const { learningId, userId, status, survey, ...rest } = payload;

  if (!learningId) {
    return NextResponse.json({ error: "learningId is required" }, { status: 400 });
  }

  if (survey && userId) {
    try {
      const result = await recordSurveyAndAssignNext({ userId, learningId, survey });
      const assignment = await syncLearningAssignment(userId, true);
      return NextResponse.json({ ...result, assignment });
    } catch (error) {
      console.error("[API/learning] Failed to record survey", error);
      return NextResponse.json({ error: "Failed to save survey" }, { status: 500 });
    }
  }

  try {
    const { resource: existing } = await containers.micro_learning
      .item(learningId, learningId)
      .read();

    if (!existing) {
      return NextResponse.json({ error: "Learning module not found" }, { status: 404 });
    }

    const updated = {
      ...existing,
      ...rest,
    };

    if (status) {
      updated.status = status;
    }

    const { resource } = await containers.micro_learning.item(learningId, learningId).replace(updated);

    if (userId && status) {
      await upsertResponseStatus({
        userId,
        microLearningId: learningId,
        status,
        quizzes: Array.isArray(updated.quizzes) ? updated.quizzes : existing?.quizzes || [],
      });

      if (status.toLowerCase() === "completed") {
        await awardXpAction({
          userId,
          actionType: "micro-learning",
          metadata: {
            details: {
              learningId,
            },
          },
        });
        await syncLearningAssignment(userId, true);
      }
    }

    return NextResponse.json(resource);
  } catch (error) {
    console.error("[API/learning] Failed to update module", error);
    return NextResponse.json({ error: "Failed to update learning module" }, { status: 500 });
  }
}

async function GET(req) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const forceAssignment = searchParams.get("sync") === "1";

  if (!userId) {
    const { resources: learningModules } = await containers.micro_learning.items.readAll().fetchAll();
    return NextResponse.json(learningModules);
  }

  try {
    await ensureUserHasProfile(userId);
    const assignment = await syncLearningAssignment(userId, forceAssignment);
    return NextResponse.json(assignment);
  } catch (error) {
    console.error("[API/learning] Failed to fetch assignment", error);
    return NextResponse.json({ error: "Failed to load assignment" }, { status: 500 });
  }
}

module.exports = {
    POST,
    PATCH,
    GET
};