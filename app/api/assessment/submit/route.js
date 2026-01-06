import { containers } from "../../../../lib/cosmos";
import { NextResponse } from "next/server";
import { computeStartTimestamp } from "../../../../lib/utils";
import { upsertUserProfile } from "../../../../lib/users";
import { getXpForLevel } from "../../../../lib/xp";
import { initializeUserRewards } from "../../../../lib/rewards";

const DEFAULT_SCORING_CONFIG = {
    sectionWeights: {
      'Knowledge & mental models': { weight: 30, questions: ['q1', 'q2', 'q3'] },
      'Prompting skills': { weight: 20, questions: ['q4', 'q5'] },
      'Applied judgment': { weight: 20, questions: ['q6', 'q7'] },
      'Safety awareness': { weight: 10, questions: ['q8'] },
      'Confidence': { weight: 10, questions: ['q9'] },
      'Usage frequency': { weight: 10, questions: ['q10'] },
    },
    fluencyLevels: [
      { range: [0, 20], label: 'AI Rookie' },
      { range: [21, 40], label: 'AI Learner' },
      { range: [41, 60], label: 'AI Explorer' },
      { range: [61, 75], label: 'AI Practitioner' },
      { range: [76, 90], label: 'AI Expert' },
      { range: [91, 100], label: 'AI Champion' },
    ],
};

const LEVEL_MAPPING = {
    'AI Rookie': 1,
    'AI Learner': 2,
    'AI Explorer': 3,
    'AI Practitioner': 4,
    'AI Expert': 5,
    'AI Champion': 6
};

export async function POST(request) {
  try {
    const { userId, answers } = await request.json();

    if (!userId || !Array.isArray(answers)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { resources: allAssessmentItems } = await containers.assessmentquestion.items.query("SELECT * FROM c").fetchAll();

    const dbScoringConfig = allAssessmentItems.find(item => item.id === 'scoring_config');
    const scoringConfig = dbScoringConfig || DEFAULT_SCORING_CONFIG;

    const questions = allAssessmentItems.filter(item => item.id !== 'scoring_config');

    let totalPointsEarned = 0;

    for (const question of questions) {
        const userAnswer = answers.find(a => a.questionId === question.id);
        if (!userAnswer) continue;

        if (question.type === 'mcq') {
            const section = Object.values(scoringConfig.sectionWeights).find(s => s.questions.includes(question.id));
            if (section && userAnswer.answer === question.correctAnswerIndex) {
                totalPointsEarned += section.weight / section.questions.length;
            }
        } else if (question.type === 'self_assessment') {
            // Explicit scoring for Confidence (Q9)
            // 1 → 2 pts, 2 → 4 pts, 3 → 6 pts, 4 → 8 pts, 5 → 10 pts
            const val = parseInt(userAnswer.answer, 10);
            if (!isNaN(val) && val >= 1 && val <= 5) {
                totalPointsEarned += val * 2;
            }
        } else if (question.type === 'usage_frequency') {
            // Explicit scoring for Usage Frequency (Q10)
            const map = {
                'Never': 0,
                'Monthly': 2,
                'Weekly': 5,
                'Multiple weekly': 8,
                'Daily': 10
            };
            if (map.hasOwnProperty(userAnswer.answer)) {
                totalPointsEarned += map[userAnswer.answer];
            }
        }
    }

    const fluencyScore = Math.round(totalPointsEarned);
    const fluencyLevel = scoringConfig.fluencyLevels.find(level => fluencyScore >= level.range[0] && fluencyScore <= level.range[1])?.label || "Unknown";

    const responseDoc = {
      id: `${userId}-${Date.now()}`,
      userId,
      timestamp: new Date().toISOString(),
      answers,
      fluencyScore,
      fluencyLevel,
    };

    await containers.assessmentresponse.items.create(responseDoc);
    
    // Calculate initial XP and Level based on fluency
    const targetLevel = LEVEL_MAPPING[fluencyLevel] || 1;
    const startingXp = getXpForLevel(targetLevel);

    // Update user profile with fluency score, level, and XP
    await upsertUserProfile({
        id: userId,
        fluencyScore,
        fluencyLevel,
        xp: startingXp,
        level: targetLevel
    });

    // Update rewards container to keep everything in sync
    await initializeUserRewards({
        userId,
        xp: startingXp,
        tier: fluencyLevel,
        fluencyScore
    });
    
    // Auto-assign first learning module if it doesn't exist
    const { resources: userResponses } = await containers.responses.items.query({
        query: "SELECT * FROM c WHERE c.userId = @userId",
        parameters: [{ name: "@userId", value: userId }]
    }).fetchAll();

    if (!userResponses || userResponses.length === 0) {
        // Try to find the correct starting module for this tier
        let { resources: learningModules } = await containers.ai_learning.items.query({
            query: "SELECT * FROM c WHERE c.tier = @tier ORDER BY c[\"order\"] ASC OFFSET 0 LIMIT 1",
            parameters: [{ name: "@tier", value: fluencyLevel }]
        }).fetchAll();

        // Fallback to order 1 if no module found for the specific tier
        if (learningModules.length === 0) {
             const fallbackRes = await containers.ai_learning.items.query({
                query: "SELECT * FROM c WHERE c[\"order\"] = 1"
            }).fetchAll();
            learningModules = fallbackRes.resources;
        }

        if (learningModules.length > 0) {
            const firstModule = learningModules[0];
            const nowIso = new Date().toISOString();
            const newResponse = {
                id: `${userId}-${Date.now()}`,
                userId: userId,
                learnings: [{
                    learningId: firstModule.id,
                    status: "assigned",
                    createdAt: nowIso,
                    updatedAt: nowIso,
                    availableAt: computeStartTimestamp(5), // 5 minutes delay
                    module: firstModule,
                    attempts: [],
                    quizAvailableAt: null,
                    usageAvailableAt: null
                }],
                updatedAt: nowIso
            };
            await containers.responses.items.create(newResponse);
        }
    }

    const confidenceAnswer = answers.find(a => a.questionId === 'q9')?.answer;
    const usageAnswer = answers.find(a => a.questionId === 'q10')?.answer;

    const confidenceText = questions.find(q => q.id === 'q9')?.options.find(o => o.value === confidenceAnswer)?.text;
    const usageText = questions.find(q => q.id === 'q10')?.options.find(o => o.value === usageAnswer)?.text;

    return NextResponse.json({ 
        fluencyScore, 
        fluencyLevel,
        confidence: confidenceText,
        usage: usageText
    });

  } catch (error) {
    console.error("Failed to submit assessment", error);
    return NextResponse.json({ error: "Failed to submit assessment" }, { status: 500 });
  }
}
