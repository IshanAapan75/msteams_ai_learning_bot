const { containers } = require("../../../../lib/cosmos");
const { NextResponse } = require("next/server");
const { awardXpAction } = require("../../../../lib/rewards");
const { upsertUserProfile } = require("../../../../lib/users");
const { initializeUserRewards } = require("../../../../lib/rewards");
const { calculateFluencyScore } = require("../../../../lib/fluency");
const { fetchResponseProgress, saveResponseProgress } = require("../../../../lib/learningProgress");
const { COOLDOWN_MS } = require("../../../../lib/learningPlan.js");
const { assignBadges } = require("../../../../lib/badges");

async function POST(request) {
  try {
    const { userId, learningId, responses } = await request.json();

    if (!userId || !responses) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const usageDoc = {
      id: `${userId}-${Date.now()}`,
      userId,
      learningId, // Optional, can be null for ad-hoc usage
      timestamp: new Date().toISOString(),
      responses: {
        actionType: responses.actionType,
        timeSaved: responses.timeSaved,
        confidence: responses.confidence,
        sentiment: responses.sentiment,
        notes: responses.notes
      }
    };

    const { resource: createdUsage } = await containers.userusage.items.create(usageDoc);

    // 1. Update XP and Streak
    const { xpDelta: xpEarned, streak: newStreak } = await awardXpAction({
      userId,
      actionType: "ai-usage",
      metadata: {
        details: {
          learningId,
          ...responses
        }
      }
    });

    // 2. Recalculate Dynamic Fluency Score
    const { resources: allUserLogs } = await containers.userusage.items
        .query({
            query: "SELECT * FROM c WHERE c.userId = @userId",
            parameters: [{ name: "@userId", value: userId }]
        })
        .fetchAll();
    
    const { resources: assessmentResponses } = await containers.assessmentresponse.items
        .query({
            query: "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.timestamp DESC OFFSET 0 LIMIT 1",
            parameters: [{ name: "@userId", value: userId }]
        })
        .fetchAll();

    let assessmentCorrectness = 0;
    if (assessmentResponses.length > 0) {
        assessmentCorrectness = (assessmentResponses[0].fluencyScore || 0) / 100;
    }

    const microActionsCompleted = allUserLogs.filter(l => l.responses?.actionType).length;

    const newFluencyScore = calculateFluencyScore({
        recentLogs: allUserLogs,
        streak: newStreak,
        microActionsCompleted,
        assessmentCorrectness
    });

    // 3. Update User Profile & Rewards
    const { resource: currentProfile } = await containers.users.item(userId, userId).read();
    
    const badges = await assignBadges({ ...currentProfile, streak: newStreak });

    await upsertUserProfile({
        id: userId,
        fluencyScore: newFluencyScore,
        badges,
        streak: newStreak
    });

    const { resource: rewardRecord } = await containers.rewards.item(userId, userId).read();
    if (rewardRecord) {
        rewardRecord.fluency = newFluencyScore;
        await containers.rewards.items.upsert(rewardRecord);
    }

    // 4. Assign Next Learning Module (if applicable)
    let nextModuleInfo = null;
    
    if (learningId) {
        const { resource: currentModule } = await containers.ai_learning.item(learningId, learningId).read();
        
        if (currentModule && typeof currentModule.order === 'number') {
            const currentOrder = currentModule.order;
            const currentTier = currentModule.tier || "AI Rookie";
            
            const { resources: nextModules } = await containers.ai_learning.items.query({
                query: "SELECT * FROM c WHERE c.tier = @tier AND c[\"order\"] > @currentOrder ORDER BY c[\"order\"] ASC OFFSET 0 LIMIT 1",
                parameters: [
                    { name: "@tier", value: currentTier },
                    { name: "@currentOrder", value: currentOrder }
                ]
            }).fetchAll();
            
            let nextModule = nextModules[0];
            
            if (nextModule) {
                const now = new Date();
                const availableAt = new Date(now.getTime() + COOLDOWN_MS).toISOString(); 
                
                const userResponse = await fetchResponseProgress(userId);
                const nextEntry = {
                    learningId: nextModule.id,
                    status: "available",
                    createdAt: now.toISOString(),
                    updatedAt: now.toISOString(),
                    availableAt: availableAt,
                    module: nextModule,
                    attempts: [],
                    quizAvailableAt: null,
                    usageAvailableAt: null
                };
                
                userResponse.learnings.push(nextEntry);
                await saveResponseProgress(userResponse);
                
                nextModuleInfo = {
                    title: nextModule.title || nextModule.topic,
                    availableAt: availableAt
                };
            }
        }
    }

    return NextResponse.json({
      success: true, 
      usageId: createdUsage.id,
      xpEarned,
      streak: newStreak,
      fluencyScore: newFluencyScore,
      nextModule: nextModuleInfo
    });

  } catch (error) {
    console.error("Failed to log usage", error);
    return NextResponse.json({ error: "Failed to log usage" }, { status: 500 });
  }
}

module.exports = {
    POST
};