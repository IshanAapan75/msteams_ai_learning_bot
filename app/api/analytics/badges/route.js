import { NextResponse } from "next/server";
import { getUserById, getRewardsByUserId, getResponsesByUserId } from "../../../../lib/analytics";
import { levels, skillBadges, streakBadges, productivityBadges } from "../../../../lib/badgeDefinitions";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId query param is required" }, { status: 400 });
  }

  try {
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const rewards = await getRewardsByUserId(userId);
    const userResponses = await getResponsesByUserId(userId);

    const totalXp = rewards?.xp || 0;
    const currentStreak = rewards?.streak || 0;
    const earnedBadgeIds = rewards?.badges || [];

    // --- Calculate Level Progress ---
    const currentLevelEntry = levels.slice().reverse().find(level => totalXp >= level.minXP) || levels[0];
    const currentLevel = currentLevelEntry.name;
    const currentLevelNum = levels.indexOf(currentLevelEntry) + 1;
    const nextLevelEntry = levels[currentLevelNum];
    const nextLevelXP = nextLevelEntry?.minXP || (totalXp >= levels[levels.length -1].minXP ? totalXp : levels[levels.length -1].minXP);
    const xpProgress = nextLevelXP ? (totalXp / nextLevelXP) * 100 : 0;
    const xpToNextLevel = Math.max(0, nextLevelXP - totalXp);

    // --- Process Badges ---
    const processBadges = (badgeDefs, userRewards, userResponses) => {
      return badgeDefs.map(badgeDef => {
        const earned = earnedBadgeIds.includes(badgeDef.id);
        let progress = 0; // Default progress
        let progressDetail = ""; // More descriptive progress

        // Example: calculate progress for streak badges
        if (badgeDef.criteria?.streak) {
          progress = Math.min(100, (currentStreak / badgeDef.criteria.streak) * 100);
          progressDetail = `Current streak: ${currentStreak}/${badgeDef.criteria.streak} days`;
        }
        
        // Example: calculate progress for total usage logs
        if (badgeDef.criteria?.totalUsageLogs) {
            const totalLogs = userResponses?.learnings?.filter(l => l.survey)?.length || 0;
            progress = Math.min(100, (totalLogs / badgeDef.criteria.totalUsageLogs) * 100);
            progressDetail = `Logged ${totalLogs}/${badgeDef.criteria.totalUsageLogs} uses`;
        }

        // Example: calculate progress for total minutes saved (assuming survey.timeSaved can be parsed)
        if (badgeDef.criteria?.totalMinutesSaved) {
            const minutesSavedMap = {
                "1-5 min": 3, // Average
                "6-15 min": 10,
                "16-30 min": 23,
                "31-60 min": 45,
                "60+ min": 90, // Representative large number
            };
            const totalSaved = userResponses?.learnings?.filter(l => l.survey).reduce((sum, l) => {
                return sum + (minutesSavedMap[l.survey.timeSaved] || 0);
            }, 0) || 0;
            progress = Math.min(100, (totalSaved / badgeDef.criteria.totalMinutesSaved) * 100);
            progressDetail = `Saved ${totalSaved}/${badgeDef.criteria.totalMinutesSaved} minutes`;
        }

        // Example: calculate progress for unique task types (skill-quick-learner)
        if (badgeDef.id === "quick-learner" && badgeDef.criteria?.taskTypes) {
            const uniqueTaskTypes = new Set(userResponses?.learnings?.filter(l => l.survey).map(l => l.survey.actionType)).size;
            progress = Math.min(100, (uniqueTaskTypes / badgeDef.criteria.taskTypes) * 100);
            progressDetail = `Completed ${uniqueTaskTypes}/${badgeDef.criteria.taskTypes} unique AI tasks`;
        }
        
        // Example: calculate progress for high confidence logs (quality-champion)
        if (badgeDef.id === "quality-champion" && badgeDef.criteria?.confidence === "high" && badgeDef.criteria?.count) {
            const highConfidenceLogs = userResponses?.learnings?.filter(l => l.survey && l.survey.confidence === "High").length || 0;
            progress = Math.min(100, (highConfidenceLogs / badgeDef.criteria.count) * 100);
            progressDetail = `Logged ${highConfidenceLogs}/${badgeDef.criteria.count} high-confidence uses`;
        }


        // Other badge progress calculations would go here based on their specific criteria

        return {
          ...badgeDef,
          earned,
          progress: earned ? 100 : Math.floor(progress), // If earned, progress is 100%
          progressDetail: earned ? "Earned" : progressDetail,
        };
      });
    };

    const processedSkillBadges = processBadges(skillBadges, rewards, userResponses);
    const processedStreakBadges = processBadges(streakBadges, rewards, userResponses);
    const processedProductivityBadges = processBadges(productivityBadges, rewards, userResponses);

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
      },
      metrics: {
        totalXp,
        currentLevel,
        currentLevelNum,
        xpProgress,
        nextLevelXP,
        xpToNextLevel,
        currentStreak,
      },
      skillBadges: processedSkillBadges,
      streakBadges: processedStreakBadges,
      productivityBadges: processedProductivityBadges,
    });
  } catch (error) {
    console.error("[API analytics badges]", error);
    return NextResponse.json({ error: "Failed to load badge data" }, { status: 500 });
  }
}
