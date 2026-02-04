const { containers } = require("../../../../lib/cosmos");
const { NextResponse } = require("next/server");
const { upsertUserProfile } = require("../../../../lib/users");
const { getXpForLevel } = require("../../../../lib/xp");
const { initializeUserRewards } = require("../../../../lib/rewards");
const { fetchResponseProgress, saveResponseProgress } = require("../../../../lib/learningProgress");
const { fetchLearningCatalog } = require("../../../../lib/learningPlan.js");

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
    
    // Auto-assign first learning module if it doesn't exist or Day 1 isn't complete
    const userResponse = await fetchResponseProgress(userId);
    const learnings = userResponse.learnings || [];

    const day1Entry = learnings.find(l => l.learningId === 'micro-learning-day-1');
    const isDay1FullyDone = day1Entry && day1Entry.status === 'completed' && day1Entry.quizPassedAt;

    if (!isDay1FullyDone) {
        // If they have other modules but Day 1 isn't done, clear them out
        const hasOtherModules = learnings.some(l => l.learningId !== 'micro-learning-day-1');
        
        if (hasOtherModules || !day1Entry) {
            const { resource: firstModule } = await containers.ai_learning.item('micro-learning-day-1', 'micro-learning-day-1').read();

            if (firstModule) {
                const nowIso = new Date().toISOString();
                userResponse.learnings = [{
                    learningId: firstModule.id,
                    status: "available",
                    createdAt: nowIso,
                    updatedAt: nowIso,
                    availableAt: nowIso, // IMMEDIATE
                    module: firstModule,
                    attempts: [],
                    quizAvailableAt: null,
                    usageAvailableAt: null
                }];
                await saveResponseProgress(userResponse);
            }
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
