import { NextResponse } from "next/server";
import { containers } from "../../../../lib/cosmos.js";
import {
  fetchResponseProgress,
  getLearningEntry,
  getPendingAttempts,
  upsertLearningEntry,
} from "../../../../lib/learningProgress";
import { syncLearningAssignment } from "../../../../lib/learningPlan.js";
import { ensureUserHasProfile } from "../../../../lib/users.js";

export const runtime = 'nodejs';
export const dynamic = "force-dynamic";

async function populateQuestions(quiz) {
  if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    return quiz;
  }

  const populatedQuestions = [];

  for (const qid of quiz.questions) {
    if (typeof qid === "string") {
      try {
        const { resource: question } = await containers.questions.item(qid, qid).read();
        if (question) {
          populatedQuestions.push(question);
          console.log(`[API/quiz/assign] Loaded question: ${question.id} for quiz: ${quiz.title}`);
        }
      } catch (err) {
        console.error(`[API/quiz/assign] Error loading question ${qid}: ${err.message}`);
      }
    } else if (qid && typeof qid === "object") {
      populatedQuestions.push(qid);
    }
  }

  return { ...quiz, questions: populatedQuestions };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const userId = body.userId;
    const fetchAll = body.fetchAll;
    const microLearningId = body.microLearningId ?? body.aiLearningId ?? null;
    const microLearningQuizzes = body.microLearningQuizzes ?? body.aiLearningQuizzes ?? [];
    console.log(
      `[API/quiz/assign] Request for userId: ${userId}, fetchAll: ${fetchAll}, microLearningId: ${microLearningId}`
    );

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    await ensureUserHasProfile(userId);
    const progressDoc = await fetchResponseProgress(userId);

    const { resources: learningRecords } = await containers.micro_learning.items
      .query({
        query: "SELECT * FROM c WHERE c.userId = @userId",
        parameters: [{ name: "@userId", value: userId }],
      })
      .fetchAll();

    const manualQuizList = Array.isArray(microLearningQuizzes) ? microLearningQuizzes.filter(Boolean) : [];
    let effectiveLearningId = microLearningId;

    if (!effectiveLearningId && Array.isArray(progressDoc.learnings)) {
      const lastCompleted = progressDoc.learnings.find((entry) => entry.status === "completed");
      if (lastCompleted) {
        effectiveLearningId = lastCompleted.learningId;
      }
    }

    let targetLearning = effectiveLearningId
      ? getLearningEntry(progressDoc, effectiveLearningId)
      : null;

    if (!targetLearning && effectiveLearningId) {
      await upsertLearningEntry({
        userId,
        learningId: effectiveLearningId,
        status: "completed",
        quizIds: manualQuizList,
      });
      targetLearning = await (async () => {
        const reloaded = await fetchResponseProgress(userId);
        return getLearningEntry(reloaded, effectiveLearningId);
      })();
    }

    if (!targetLearning || targetLearning.status?.toLowerCase() !== "completed") {
      const completedModule = learningRecords.find(
        (module) => module.id === effectiveLearningId || module.status?.toLowerCase() === "completed"
      );

      if (completedModule) {
        await upsertLearningEntry({
          userId,
          learningId: completedModule.id,
          status: completedModule.status || "completed",
          quizIds: Array.isArray(completedModule.quizzes) ? completedModule.quizzes : [],
        });
        const reloaded = await fetchResponseProgress(userId);
        targetLearning = getLearningEntry(reloaded, completedModule.id);
        effectiveLearningId = completedModule.id;
      }
    }

    if (!targetLearning || targetLearning.status?.toLowerCase() !== "completed") {
      const assignment = await syncLearningAssignment(userId);
      return NextResponse.json(
        {
          error: "Complete the microlearning module before taking quizzes.",
          microLearningStatus: targetLearning?.status || assignment.status || "not started",
          assignment,
        },
        { status: 403 }
      );
    }

    let targetQuizIds = manualQuizList;

    if (!targetQuizIds || targetQuizIds.length === 0) {
      const pendingAttempts = getPendingAttempts(targetLearning);
      if (pendingAttempts.length > 0) {
        targetQuizIds = pendingAttempts.map((attempt) => attempt.quizId).filter(Boolean);
      }
    }

    if ((!targetQuizIds || targetQuizIds.length === 0) && effectiveLearningId) {
      const module = learningRecords.find((item) => item.id === effectiveLearningId);
      if (module && Array.isArray(module.quizzes)) {
        targetQuizIds = module.quizzes.filter(Boolean);
        await upsertLearningEntry({
          userId,
          learningId: effectiveLearningId,
          status: targetLearning.status,
          quizIds: targetQuizIds,
        });
      }
    }

    // Fetch quizzes
    const { resources: quizzes } = await containers.quizzes.items.readAll().fetchAll();

    if (!quizzes || quizzes.length === 0) {
      console.warn(`[API/quiz/assign] No quizzes found in Cosmos DB.`);
      return NextResponse.json({ error: "No quizzes available" }, { status: 404 });
    }

    console.log(`[API/quiz/assign] Found ${quizzes.length} quizzes`);

    let filteredQuizzes = quizzes;
    if (Array.isArray(targetQuizIds) && targetQuizIds.length > 0) {
      filteredQuizzes = quizzes.filter((quiz) => targetQuizIds.includes(quiz.id));
      console.log(
        `[API/quiz/assign] Filtered quizzes by microlearning ${effectiveLearningId}. Result count: ${filteredQuizzes.length}`
      );
    }

    if (!filteredQuizzes || filteredQuizzes.length === 0) {
      return NextResponse.json(
        {
          error: "No quizzes are linked to the completed learning module.",
          microLearningId: effectiveLearningId,
        },
        { status: 404 }
      );
    }

    const populatedQuizzes = [];
    for (const quiz of filteredQuizzes) {
      const populatedQuiz = await populateQuestions(quiz);
      populatedQuizzes.push(populatedQuiz);
      if (!fetchAll) {
        break;
      }
    }

    console.log(
      `[API/quiz/assign] Returning ${populatedQuizzes.length} quizzes with questions for learning ${effectiveLearningId}`
    );

    await upsertLearningEntry({
      userId,
      learningId: effectiveLearningId,
      status: "completed",
      quizIds: targetQuizIds,
    });

    return NextResponse.json({
      quizzes: populatedQuizzes,
      microLearningId: effectiveLearningId,
      microLearningStatus: targetLearning.status || "completed",
    });
  } catch (error) {
    console.error(`[API/quiz/assign] Error processing request: ${error.message}`);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}

