const { containers } = require("./cosmos.js");
const { calculateLevel } = require("./xp");
const { streakBadges, skillBadges, productivityBadges } = require("./badgeDefinitions.js");

const TIME_SAVED_MAP = {
    "1-5 min": 3,
    "6-15 min": 10,
    "16-30 min": 23,
    "31-60 min": 45,
    "60+ min": 75
};

async function assignBadges(user) {
  const awardedBadges = [];
  const userId = user.id;

  try {
      // 1. Fetch current owned badges
      const { resources: userBadges } = await containers.badges.items
        .query({
          query: "SELECT * FROM c WHERE c.userId = @userId",
          parameters: [{ name: "@userId", value: userId }],
        })
        .fetchAll();

      const hasBadge = (badgeId) =>
        userBadges.some((b) => b.id === badgeId || b.badgeName === badgeId);

      // 2. Fetch Usage History for calculations
      const { resources: allLogs } = await containers.userusage.items
        .query({
          query: "SELECT * FROM c WHERE c.userId = @userId",
          parameters: [{ name: "@userId", value: userId }],
        })
        .fetchAll();

      // 3. Calculate Metrics
      const level = calculateLevel(user.xp);
      const currentStreak = user.streak || 0;
      
      const totalUsageLogs = allLogs.length;
      const uniqueTaskTypes = new Set(allLogs.map(l => l.responses?.actionType).filter(Boolean)).size;
      const highConfidenceCount = allLogs.filter(l => String(l.responses?.confidence) === "5").length;
      
      // Time calculations
      let totalMinutesSaved = 0;
      let monthlyMinutesSaved = 0;
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

      allLogs.forEach(log => {
          const mins = TIME_SAVED_MAP[log.responses?.timeSaved] || 0;
          totalMinutesSaved += mins;
          if (new Date(log.timestamp).getTime() >= startOfMonth) {
              monthlyMinutesSaved += mins;
          }
      });

      // --- AWARD LOGIC ---

      // A. Level-based Metal Badges
      const metalMilestones = [
          { id: "bronze", level: 2, name: "Bronze" },
          { id: "silver", level: 4, name: "Silver" },
          { id: "gold", level: 6, name: "Gold" }
      ];
      for (const m of metalMilestones) {
          if (level >= m.level && !hasBadge(m.id)) {
              const { resource } = await containers.badges.items.create({
                  id: m.id, userId, badgeName: m.name, awardedAt: new Date().toISOString()
              });
              awardedBadges.push(resource);
          }
      }

      // B. Streak Badges
      for (const sBadge of streakBadges) {
          if (currentStreak >= sBadge.days && !hasBadge(sBadge.id)) {
              const { resource } = await containers.badges.items.create({
                  id: sBadge.id, userId, badgeName: sBadge.name, awardedAt: new Date().toISOString()
              });
              awardedBadges.push(resource);
          }
      }

      // C. Skill Badges
      const skillChecks = [
          { id: "quick-learner", val: uniqueTaskTypes, target: 5 },
          { id: "power-user", val: totalUsageLogs, target: 100 },
          { id: "quality-champion", val: highConfidenceCount, target: 10 }
      ];
      for (const check of skillChecks) {
          const def = skillBadges.find(b => b.id === check.id);
          if (def && check.val >= check.target && !hasBadge(check.id)) {
              const { resource } = await containers.badges.items.create({
                  id: def.id, userId, badgeName: def.name, awardedAt: new Date().toISOString()
              });
              awardedBadges.push(resource);
          }
      }

      // D. Productivity Badges
      for (const pBadge of productivityBadges) {
          if (totalMinutesSaved >= pBadge.minutes && !hasBadge(pBadge.id)) {
              const { resource } = await containers.badges.items.create({
                  id: pBadge.id, userId, badgeName: pBadge.name, awardedAt: new Date().toISOString()
              });
              awardedBadges.push(resource);
          }
      }

      // E. Monthly Hero Badge
      if (monthlyMinutesSaved >= 300 && !hasBadge("productivity-hero")) {
          const def = skillBadges.find(b => b.id === "productivity-hero");
          if (def) {
              const { resource } = await containers.badges.items.create({
                  id: def.id, userId, badgeName: def.name, awardedAt: new Date().toISOString()
              });
              awardedBadges.push(resource);
          }
      }
  } catch (err) {
      console.error("[Badges] Critical error assigning badges:", err);
  }

  return awardedBadges;
}

module.exports = {
    assignBadges
};