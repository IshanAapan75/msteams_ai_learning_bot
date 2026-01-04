import { containers } from "../../../../lib/cosmos";
import { NextResponse } from "next/server";
import { computeStartTimestamp } from "../../../../lib/utils";

export async function POST(request) {
  try {
    const { userId, answers } = await request.json();

    if (!userId || !Array.isArray(answers)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { resources: allAssessmentItems } = await containers.assessmentquestion.items.query("SELECT * FROM c").fetchAll();

    const scoringConfig = allAssessmentItems.find(item => item.id === 'scoring_config');
    if (!scoringConfig) {
      return NextResponse.json({ error: "Scoring configuration not found" }, { status: 500 });
    }

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
        } else if (question.type === 'self_assessment' || question.type === 'usage_frequency') {
            const selectedOption = question.options.find(opt => opt.value === userAnswer.answer);
            if (selectedOption) {
                totalPointsEarned += selectedOption.score;
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
    
    // Auto-assign first learning module if it doesn't exist
    const { resources: userResponses } = await containers.responses.items.query({
        query: "SELECT * FROM c WHERE c.userId = @userId",
        parameters: [{ name: "@userId", value: userId }]
    }).fetchAll();

    if (!userResponses || userResponses.length === 0) {
        const { resources: learningModules } = await containers.ai_learning.items.query({
            query: "SELECT * FROM c WHERE c[\"order\"] = 1"
        }).fetchAll();

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
