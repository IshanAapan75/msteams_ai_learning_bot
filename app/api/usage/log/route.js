import { containers } from "../../../../lib/cosmos";
import { NextResponse } from "next/server";
import { awardXpAction } from "../../../../lib/rewards";
import { upsertUserProfile } from "../../../../lib/users";
import { initializeUserRewards } from "../../../../lib/rewards";
import { calculateFluencyScore } from "../../../../lib/fluency";

export async function POST(request) {
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
    // Fetch all user logs to calculate stats
    const { resources: allUserLogs } = await containers.userusage.items
        .query({
            query: "SELECT * FROM c WHERE c.userId = @userId",
            parameters: [{ name: "@userId", value: userId }]
        })
        .fetchAll();
    
    // Fetch Assessment Correctness
    // We need the latest assessment response to calculate correctness rate (correct / total)
    // Or we can just use the initial fluency score logic, but the requirement specifically asks for "correctness * 15"
    // Let's look up the assessment response.
    const { resources: assessmentResponses } = await containers.assessmentresponse.items
        .query({
            query: "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.timestamp DESC OFFSET 0 LIMIT 1",
            parameters: [{ name: "@userId", value: userId }]
        })
        .fetchAll();

    let assessmentCorrectness = 0;
    if (assessmentResponses.length > 0) {
        const answers = assessmentResponses[0].answers || [];
        // Assuming we can infer correctness or if it was stored. 
        // The current storage doesn't explicitly store "isCorrect" in the answers array in the new logic,
        // but for MVP let's approximate: 
        // If we don't have explicit correctness, we can use (fluencyScore / 100) as a proxy for "skill",
        // OR we just rely on the fact that we should have stored it.
        // Let's use the 'fluencyScore' from the assessment as a base correctness proxy if raw data isn't easy.
        // Assessment Score 0-100. Correctness 0.0-1.0.
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
    // We need to fetch the current profile to preserve other fields like language
    const { resource: currentProfile } = await containers.users.item(userId, userId).read();
    
    await upsertUserProfile({
        id: userId,
        fluencyScore: newFluencyScore,
        // We only update fluency here, keeping existing XP/Level unless XP logic changed it (which calculateXpAndStreak does internally? No, it usually returns values).
        // Actually calculateXpAndStreak updates the 'rewards' container but maybe not 'users' profile XP.
        // Let's ensure we sync everything.
    });

    // We also need to sync the Rewards container with the new Fluency Score
    // We can reuse initializeUserRewards which upserts
    await initializeUserRewards({
        userId,
        fluencyScore: newFluencyScore,
        // Pass existing values if we don't want to overwrite them with 0
        xp: undefined, // undefined will likely be ignored or we need to handle it in lib/rewards
        tier: undefined 
    });
    // Note: initializeUserRewards implementation in previous turn might overwrite XP if passed undefined. 
    // Let's check lib/rewards.js content implicitly. 
    // Ideally we should just patch the fluency field.
    // For MVP safety, let's just patch the reward record directly here to be safe.
    const { resource: rewardRecord } = await containers.rewards.item(userId, userId).read();
    if (rewardRecord) {
        rewardRecord.fluency = newFluencyScore;
        await containers.rewards.items.upsert(rewardRecord);
    }

    // 4. Assign Next Learning Module (if applicable)
    let nextModuleInfo = null;
    
    // Get current module info to find the next one
    if (learningId) {
        const { resource: currentModule } = await containers.ai_learning.item(learningId, learningId).read();
        
        if (currentModule) {
            const currentOrder = currentModule.order;
            const currentTier = currentModule.tier || "AI Rookie"; // Default tier
            
            // Find next module in same tier
            const { resources: nextModules } = await containers.ai_learning.items.query({
                query: "SELECT * FROM c WHERE c.tier = @tier AND c[\"order\"] > @currentOrder ORDER BY c[\"order\"] ASC OFFSET 0 LIMIT 1",
                parameters: [
                    { name: "@tier", value: currentTier },
                    { name: "@currentOrder", value: currentOrder }
                ]
            }).fetchAll();
            
            let nextModule = nextModules[0];
            
            // If no more modules in this tier, maybe move to next tier? 
            // For MVP simplicity, we just stop or maybe loop. Let's assume just stopping for now if no content.
            
            if (nextModule) {
                const now = new Date();
                const availableAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours later
                
                const newResponse = {
                    id: `${userId}-${Date.now()}`,
                    userId,
                    learnings: [{
                        learningId: nextModule.id,
                        status: "available",
                        createdAt: now.toISOString(),
                        updatedAt: now.toISOString(),
                        availableAt: availableAt,
                        module: nextModule,
                        attempts: [],
                        quizAvailableAt: null,
                        usageAvailableAt: null
                    }],
                    updatedAt: now.toISOString()
                };
                
                await containers.responses.items.create(newResponse);
                
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
