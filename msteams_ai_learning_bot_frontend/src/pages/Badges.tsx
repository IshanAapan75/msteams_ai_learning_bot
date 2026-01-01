import { Card, CardContent } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Lock, Trophy, Zap, Clock, Users, Flame, Target, Award } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { authService } from "../services/auth";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export function Badges() {
  const navigate = useNavigate();
  const session = authService.getSession();

  useEffect(() => {
    if (!session) {
      navigate("/sign-in", { replace: true });
    }
  }, [session, navigate]);

  if (!session) {
    return null;
  }


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
      name: "Quick Learner",
      tier: "gold",
      description: "Completed 5 different AI task types",
      earned: true,
      icon: "⚡",
    },
    {
      name: "Productivity Hero",
      tier: "silver",
      description: "Saved 300+ minutes this month",
      earned: true,
      icon: "⏰",
    },
    {
      name: "Quality Champion",
      tier: "bronze",
      description: "10 high-confidence logs",
      earned: true,
      icon: "✨",
    },
    {
      name: "AI Pioneer",
      tier: "platinum",
      description: "First in your team to log 50 uses",
      earned: false,
      icon: "🚀",
    },
    {
      name: "Innovation Leader",
      tier: "gold",
      description: "Shared 5 AI insights with team",
      earned: false,
      icon: "💡",
    },
    {
      name: "Power User",
      tier: "silver",
      description: "Used AI 100 times",
      earned: false,
      icon: "⚙️",
    },
  ];

  const streakBadges = [
    { name: "3-Day Streak", days: 3, earned: true, icon: "🔥" },
    { name: "7-Day Streak", days: 7, earned: true, icon: "🔥🔥" },
    { name: "14-Day Streak", days: 14, earned: true, icon: "🔥🔥🔥" },
    { name: "30-Day Streak", days: 30, earned: false, icon: "🔥🔥🔥🔥" },
    { name: "60-Day Streak", days: 60, earned: false, icon: "💎" },
    { name: "100-Day Streak", days: 100, earned: false, icon: "👑" },
  ];

  const productivityBadges = [
    { name: "Time Saver I", minutes: 60, earned: true, icon: "⏱️" },
    { name: "Time Saver II", minutes: 200, earned: true, icon: "⏱️⏱️" },
    { name: "Time Saver III", minutes: 500, earned: false, icon: "⏱️⏱️⏱️" },
    { name: "Efficiency Expert", minutes: 1000, earned: false, icon: "🎯" },
  ];

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "platinum":
        return "from-cyan-300 via-blue-300 to-purple-300";
      case "gold":
        return "from-yellow-300 to-amber-400";
      case "silver":
        return "from-gray-300 to-gray-400";
      case "bronze":
        return "from-orange-300 to-orange-400";
      default:
        return "from-gray-200 to-gray-300";
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-gray-900">Badges & Levels</h2>
        <p className="text-gray-600 mt-1">Track your progress and unlock achievements</p>
      </div>

      {/* Current Level */}
      <Card className="border-gray-200 shadow-lg bg-gradient-to-br from-blue-50 to-violet-50">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-violet-500 rounded-2xl flex items-center justify-center text-4xl shadow-lg">
              {levels[currentLevelNum - 1].icon}
            </div>
            <div className="flex-1 text-center md:text-left">
              <p className="text-sm text-gray-600 mb-1">Current Level</p>
              <h3 className="text-gray-900 mb-3">{currentLevel}</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Progress to {levels[currentLevelNum]?.name || "Max Level"}</span>
                  <span className="text-gray-900">{currentXP.toLocaleString()} / {nextLevelXP.toLocaleString()} XP</span>
                </div>
                <Progress value={xpProgress} className="h-3 bg-white/50" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Level Progression */}
      <div>
        <h3 className="text-gray-900 mb-4">Level Journey</h3>
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-6">
            <div className="space-y-3">
              {levels.map((level, idx) => {
                const isUnlocked = currentXP >= level.minXP;
                const isCurrent = idx === currentLevelNum - 1;
                
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-4 p-4 rounded-lg transition-all ${
                      isCurrent
                        ? "bg-blue-50 border-2 border-blue-200"
                        : isUnlocked
                        ? "bg-gray-50"
                        : "bg-gray-50 opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${
                          isUnlocked
                            ? "bg-gradient-to-br from-blue-400 to-violet-400"
                            : "bg-gray-300"
                        }`}
                      >
                        {isUnlocked ? level.icon : <Lock className="w-5 h-5 text-gray-500" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-900">{level.name}</p>
                        <p className="text-sm text-gray-500">{level.minXP.toLocaleString()} XP required</p>
                      </div>
                    </div>
                    {isCurrent && (
                      <Badge className="bg-blue-600">Current</Badge>
                    )}
                    {isUnlocked && !isCurrent && (
                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">Unlocked</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Skill Badges */}
      <div>
        <h3 className="text-gray-900 mb-4">Skill Badges</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {skillBadges.map((badge, idx) => (
            <Card
              key={idx}
              className={`border-gray-200 shadow-sm transition-all ${
                badge.earned ? "hover:shadow-md" : "opacity-60"
              }`}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl shadow-sm ${
                      badge.earned
                        ? `bg-gradient-to-br ${getTierColor(badge.tier)}`
                        : "bg-gray-200"
                    }`}
                  >
                    {badge.earned ? badge.icon : <Lock className="w-6 h-6 text-gray-400" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900 mb-1">{badge.name}</p>
                    <p className="text-xs text-gray-500 mb-2">{badge.description}</p>
                    {badge.earned ? (
                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 text-xs">
                        Earned
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs">
                        Locked
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Streak Badges */}
      <div>
        <h3 className="text-gray-900 mb-4">Streak Badges</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {streakBadges.map((badge, idx) => (
            <Card
              key={idx}
              className={`border-gray-200 shadow-sm ${badge.earned ? "hover:shadow-md" : "opacity-60"}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <div
                    className={`w-16 h-16 rounded-xl flex items-center justify-center text-xl mb-3 shadow-sm ${
                      badge.earned
                        ? "bg-gradient-to-br from-orange-300 to-red-400"
                        : "bg-gray-200"
                    }`}
                  >
                    {badge.earned ? badge.icon : <Lock className="w-6 h-6 text-gray-400" />}
                  </div>
                  <p className="text-sm text-gray-900 mb-1">{badge.name}</p>
                  {badge.earned && (
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 text-xs">
                      ✓
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Productivity Badges */}
      <div>
        <h3 className="text-gray-900 mb-4">Productivity Badges</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {productivityBadges.map((badge, idx) => (
            <Card
              key={idx}
              className={`border-gray-200 shadow-sm ${badge.earned ? "hover:shadow-md" : "opacity-60"}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <div
                    className={`w-16 h-16 rounded-xl flex items-center justify-center text-xl mb-3 shadow-sm ${
                      badge.earned
                        ? "bg-gradient-to-br from-emerald-300 to-green-400"
                        : "bg-gray-200"
                    }`}
                  >
                    {badge.earned ? badge.icon : <Lock className="w-6 h-6 text-gray-400" />}
                  </div>
                  <p className="text-sm text-gray-900 mb-1">{badge.name}</p>
                  <p className="text-xs text-gray-500 mb-2">{badge.minutes} min</p>
                  {badge.earned && (
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 text-xs">
                      ✓
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
