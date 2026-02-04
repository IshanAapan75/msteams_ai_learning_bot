// lib/badgeDefinitions.js

const levels = [
  { name: "AI Rookie", minXP: 0, icon: "🌱" },
  { name: "AI Learner", minXP: 500, icon: "📚" },
  { name: "AI Explorer", minXP: 1500, icon: "🔍" },
  { name: "AI Practitioner", minXP: 5000, icon: "⚡" },
  { name: "AI Expert", minXP: 10000, icon: "🎯" },
  { name: "AI Champion", minXP: 25000, icon: "🏆" },
];

const skillBadges = [
  {
    id: "quick-learner",
    name: "Quick Learner",
    tier: "gold",
    description: "Completed 5 different AI task types",
    icon: "⚡",
    criteria: { taskTypes: 5 }, // Number of unique task types logged
  },
  {
    id: "productivity-hero",
    name: "Productivity Hero",
    tier: "silver",
    description: "Saved 300+ minutes this month",
    icon: "⏰",
    criteria: { totalMinutesSaved: 300, timeFrame: "month" }, // Total minutes saved
  },
  {
    id: "quality-champion",
    name: "Quality Champion",
    tier: "bronze",
    description: "10 high-confidence logs",
    icon: "✨",
    criteria: { confidence: "high", count: 10 }, // Number of high confidence logs
  },
  {
    id: "ai-pioneer",
    name: "AI Pioneer",
    tier: "platinum",
    description: "First in your team to log 50 uses",
    icon: "🚀",
    criteria: { totalUsageLogs: 50, teamRank: 1 }, // Total usage logs
  },
  {
    id: "innovation-leader",
    name: "Innovation Leader",
    tier: "gold",
    description: "Shared 5 AI insights with team",
    icon: "💡",
    criteria: { insightsShared: 5 }, // Placeholder criteria
  },
  {
    id: "power-user",
    name: "Power User",
    tier: "silver",
    description: "Used AI 100 times",
    icon: "⚙️",
    criteria: { totalUsageLogs: 100 }, // Total usage logs
  },
];

const streakBadges = [
  { id: "3-day-streak", name: "3-Day Streak", days: 3, icon: "🔥", criteria: { streak: 3 } },
  { id: "7-day-streak", name: "7-Day Streak", days: 7, icon: "🔥🔥", criteria: { streak: 7 } },
  { id: "14-day-streak", name: "14-Day Streak", days: 14, icon: "🔥🔥🔥", criteria: { streak: 14 } },
  { id: "30-day-streak", name: "30-Day Streak", days: 30, icon: "🔥🔥🔥🔥", criteria: { streak: 30 } },
  { id: "60-day-streak", name: "60-Day Streak", days: 60, icon: "💎", criteria: { streak: 60 } },
  { id: "100-day-streak", name: "100-Day Streak", days: 100, icon: "👑", criteria: { streak: 100 } },
];

const productivityBadges = [
  { id: "time-saver-i", name: "Time Saver I", minutes: 60, icon: "⏱️", criteria: { totalMinutesSaved: 60 } },
  { id: "time-saver-ii", name: "Time Saver II", minutes: 200, icon: "⏱️⏱️", criteria: { totalMinutesSaved: 200 } },
  { id: "time-saver-iii", name: "Time Saver III", minutes: 500, icon: "⏱️⏱️⏱️", criteria: { totalMinutesSaved: 500 } },
  { id: "efficiency-expert", name: "Efficiency Expert", minutes: 1000, icon: "🎯", criteria: { totalMinutesSaved: 1000 } },
];

module.exports = {
    levels,
    skillBadges,
    streakBadges,
    productivityBadges
};