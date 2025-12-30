import { containers } from "../../../../lib/cosmos";
import { addXp } from "../../../../lib/xp";
import { assignBadges } from "../../../../lib/badges";
import { awardXpAction, syncRewardBadges } from "../../../../lib/rewards";
import { markQuizAttempt } from "../../../../lib/learningProgress";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const {
      userId,
      quizId,
      answers,
      aiLearningId,
      aiLearningStatus,
      fluencyScore,
    } = await req.json();

    if (!userId || !quizId || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json(
        { error: "userId, quizId and at least one answer are required" },
        { status: 400 }
      );
    }

    const evaluatedResponses = [];
    let correctCount = 0;

    for (const response of answers) {
      const { questionId, answer, answeredAt } = response || {};
      if (!questionId) {
        console.warn("[API/quiz/answer] Missing questionId in answer payload");
        continue;
      }

      try {
        const { resource: question } = await containers.questions
          .item(questionId, questionId)
          .read();

        if (!question) {
          console.warn(`[API/quiz/answer] Question ${questionId} not found.`);
          continue;
        }

        const isCorrect = question.correctAnswer === answer;
        if (isCorrect) {
          correctCount += 1;
        }

        evaluatedResponses.push({
          questionId,
          answer,
          correct: isCorrect,
          correctAnswer: question.correctAnswer,
          xpValue: question.xp || 0,
          answeredAt: answeredAt || new Date().toISOString(),
        });
      } catch (error) {
        console.error(
          `[API/quiz/answer] Failed to evaluate question ${questionId}:`,
          error
        );
      }
    }

    if (evaluatedResponses.length === 0) {
      return NextResponse.json(
        { error: "Unable to evaluate any of the provided answers" },
        { status: 400 }
      );
    }

    const score = {
      correct: correctCount,
      total: evaluatedResponses.length,
    };

    const passThreshold = score.total === 0 ? 0 : score.total * 0.6;
    const result = score.correct >= passThreshold ? "passed" : "needs_review";

    const { resource: user } = await containers.users.item(userId, userId).read();

    const rewardResult = await awardXpAction({
      userId,
      actionType: "micro-assessment",
      fluencyOptions: {
        correctAnswers: score.correct,
        totalQuestions: score.total,
      },
      metadata: {
        awarded: "xp",
        details: {
          quizId,
          result,
        },
      },
    });

    const xpResult = addXp(user.xp || 0, rewardResult.xpDelta);
    const badges = await assignBadges({ ...user, ...xpResult });

    await containers.users.item(userId, userId).replace({
      ...user,
      ...xpResult,
      badges,
    });

    const totalXpEarned = evaluatedResponses.reduce((sum, entry) => {
      if (!entry) return sum;
      const xpValue = typeof entry.xpValue === "number" ? entry.xpValue : 0;
      return entry.correct ? sum + xpValue : sum;
    }, 0);

    const submission = {
      quizId,
      responses: evaluatedResponses,
      score,
      result,
      xpEarned: totalXpEarned,
      fluencyScore:
        typeof fluencyScore === "number" ? fluencyScore : null /* placeholder */,
      aiLearningStatus: aiLearningStatus || null,
      submittedAt: new Date().toISOString(),
    };

    if (!aiLearningId) {
      return NextResponse.json(
        { error: "aiLearningId is required to record quiz attempts" },
        { status: 400 }
      );
    }

    const attemptUpdate = await markQuizAttempt({
      userId,
      learningId: aiLearningId,
      quizId,
      update: {
        status: "completed",
        responses: evaluatedResponses,
        score,
        result,
        xpEarned: totalXpEarned,
        submittedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      },
    });

    let rewardRecord = rewardResult.reward;

    if (badges?.length) {
      rewardRecord = await syncRewardBadges(userId, badges);
    }

    return NextResponse.json({
      score,
      result,
      xpEarned: rewardResult.xpDelta,
      fluencyScore: rewardRecord.fluency,
      totalXp: xpResult.xp,
      level: xpResult.level,
      badges,
      aiLearningId,
      aiLearningStatus: attemptUpdate?.entry?.status || aiLearningStatus || "completed",
      streak: rewardResult.streak,
      streakMultiplier: rewardResult.multiplier,
      rewards: rewardRecord,
    });
  } catch (error) {
    console.error("[API/quiz/answer] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
