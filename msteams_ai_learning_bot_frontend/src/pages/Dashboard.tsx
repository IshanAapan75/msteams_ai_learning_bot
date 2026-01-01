import { TrendingUp, Flame, Target, Clock, Plus, Zap, Calendar, Smile } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { useMemo } from "react";
import { analyticsService } from "../services/analytics";
import { authService } from "../services/auth";
import { useAnalyticsData } from "../hooks/useAnalyticsData";
import type { OverviewResponse, TrendResponse, HabitsResponse, LearningResponse, QuizResponse, WinsResponse } from "../types/analytics";
import { ErrorState } from "../components/analytics/DataState";
import { SectionSkeleton } from "../components/analytics/LoadingBlocks";

export function Dashboard() {
  const navigate = useNavigate();
  const session = authService.getSession();

  if (!session) {
    navigate("/sign-in");
    return null;
  }

  const overviewState = useAnalyticsData<OverviewResponse>(() => analyticsService.getOverview());
  const trendState = useAnalyticsData<TrendResponse>(() => analyticsService.getTrend({ range: 14 }));
  const habitsState = useAnalyticsData<HabitsResponse>(() => analyticsService.getHabits());
  const learningState = useAnalyticsData<LearningResponse>(() => analyticsService.getLearning());
  const quizState = useAnalyticsData<QuizResponse>(() => analyticsService.getQuiz());
  const winsState = useAnalyticsData<WinsResponse>(() => analyticsService.getWins({ limit: 5 }));

  const currentXP = overviewState.data?.metrics.totalXp ?? 0;
  const nextLevelXP = overviewState.data?.metrics.nextMilestoneXp ?? 100;
  const xpProgress = nextLevelXP ? (currentXP / nextLevelXP) * 100 : 0;
  const currentStreak = overviewState.data?.metrics.streak ?? 0;
  const level = overviewState.data?.metrics.level ?? 1;
  const lastActionDate = overviewState.data?.metrics.lastActionDate;

  const trendStats = useMemo(() => {
    if (!trendState.data) return { xp30: 0, dailyAvg: 0 };
    const total = trendState.data.series.reduce((sum, point) => sum + point.xpEarned, 0);
    return {
      xp30: total,
      dailyAvg: trendState.data.series.length ? Math.round(total / trendState.data.series.length) : 0,
    };
  }, [trendState.data]);

  const getConfidenceColor = (level: string) => {
    if (level === "High") return "from-emerald-400 to-green-500";
    if (level === "Medium") return "from-yellow-400 to-orange-500";
    return "from-orange-400 to-red-500";
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-gray-900">
            {overviewState.loading ? "Loading dashboard..." : `Welcome back, ${overviewState.data?.user?.name || "Analyst"}!`}
          </h2>
          <p className="text-gray-600 mt-1">
            {overviewState.loading
              ? "Preparing your insights"
              : overviewState.data?.metrics.lastActionDate
              ? `Last active ${new Date(lastActionDate!).toString()}`
              : "Let's build momentum today"}
          </p>
        </div>
        <Link to="/usage-log">
          <Button className="bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">
            <Plus className="w-4 h-4 mr-2" />
            Log AI Usage
          </Button>
        </Link>
      </div>

      {/* XP Progress */}
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-gray-600">Current Level</p>
              <p className="text-gray-900">
                {overviewState.loading ? "—" : `Level ${level}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">XP Progress</p>
              <p className="text-gray-900">
                {overviewState.loading ? "Loading..." : `${currentXP.toLocaleString()} / ${nextLevelXP.toLocaleString()}`}
              </p>
            </div>
          </div>
          <Progress value={xpProgress} className="h-3 bg-gray-100" />
          <p className="text-xs text-gray-500 mt-2">
            {overviewState.loading
              ? "Crunching numbers"
              : `${Math.max(0, nextLevelXP - currentXP).toLocaleString()} XP to next level`}
          </p>
        </CardContent>
      </Card>

      {/* AI Fluency Score - uses habits */}
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 via-violet-50 to-purple-50 shadow-lg">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="64" cy="64" r="58" stroke="#e5e7eb" strokeWidth="8" fill="none" />
                  <circle
                    cx="64"
                    cy="64"
                    r="58"
                    stroke="url(#fluency-gradient)"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${((habitsState.data?.components.confidence || 0) / 100) * 364} 364`}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                  <defs>
                    <linearGradient id="fluency-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" className="text-blue-500" stopColor="currentColor" />
                      <stop offset="100%" className="text-violet-500" stopColor="currentColor" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl text-gray-900">
                    {habitsState.loading ? "—" : habitsState.data?.components.confidence ?? 0}
                  </span>
                  <span className="text-xs text-gray-500">confidence</span>
                </div>
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <p className="text-sm text-gray-600 mb-1">Your AI Fluency Mix</p>
              {habitsState.loading ? (
                <p className="text-gray-400">Measuring habits...</p>
              ) : (
                <h3 className="text-gray-900 mb-2">
                  Top strengths: {Object.entries(habitsState.data?.components || {})
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 2)
                    .map(([key]) => key)
                    .join(" & ") || "in progress"}
                </h3>
              )}
              <p className="text-sm text-gray-600 mb-3">
                {trendState.loading
                  ? "Generating streak insights"
                  : `You earned ${trendStats.xp30} XP in the last ${trendState.data?.rangeDays} days`}
              </p>
              <Link to="/assessment">
                <Button variant="outline" size="sm" className="rounded-lg border-blue-300 text-blue-700 hover:bg-blue-100">
                  Retake Assessment
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">Confidence</p>
                <p className="text-gray-900 mb-1">
                  {learningState.loading ? "—" : learningState.data?.scope === "personal" ? "High" : "Mixed"}
                </p>
                <p className="text-xs text-gray-500">Based on learning completions</p>
              </div>
              <div className={`w-12 h-12 bg-gradient-to-br ${getConfidenceColor("High")} rounded-xl flex items-center justify-center`}>
                <Smile className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">Current Streak</p>
                <p className="text-gray-900 mb-1">{overviewState.loading ? "—" : `${currentStreak} days`}</p>
                <p className="text-xs text-gray-500">Keep it going!</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center">
                <Flame className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">Daily Avg XP</p>
                <p className="text-gray-900 mb-1">{trendState.loading ? "—" : `${trendStats.dailyAvg} xp`}</p>
                <p className="text-xs text-gray-500">Last {trendState.data?.rangeDays || 0} days</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-violet-400 to-purple-500 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">Total XP</p>
                <p className="text-gray-900 mb-1">{overviewState.loading ? "—" : currentXP.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Lifetime earned</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">XP to Milestone</p>
                <p className="text-gray-900 mb-1">
                  {overviewState.loading ? "—" : `${overviewState.data?.metrics.xpToNextMilestone ?? 0} xp`}
                </p>
                <p className="text-xs text-gray-500">Next badge unlock</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity / Learning */}
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-900">Recent Learning Wins</h3>
            <Link to="/badges" className="text-sm text-blue-600 hover:text-blue-700">
              View all →
            </Link>
          </div>
          {learningState.error && <ErrorState message={learningState.error} />}
          {learningState.loading && <SectionSkeleton rows={3} />}
          {!learningState.loading && learningState.data && (
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-blue-50">
                <p className="text-xs text-gray-500">Not started</p>
                <p className="text-2xl text-gray-900">{learningState.data.summary.notStarted}</p>
              </div>
              <div className="p-4 rounded-xl bg-violet-50">
                <p className="text-xs text-gray-500">In progress</p>
                <p className="text-2xl text-gray-900">{learningState.data.summary.inProgress}</p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50">
                <p className="text-xs text-gray-500">Completed</p>
                <p className="text-2xl text-gray-900">{learningState.data.summary.completed}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quiz Activity */}
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-6 space-y-4">
          <h3 className="text-gray-900">Quiz activity</h3>
          {quizState.error && <ErrorState message={quizState.error} />}
          {quizState.loading && <SectionSkeleton rows={4} />}
          {!quizState.loading && quizState.data && (
            <div className="grid sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Attempts</p>
                <p className="text-2xl text-gray-900">{quizState.data.attempts}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Passed</p>
                <p className="text-2xl text-gray-900">{quizState.data.passed}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Pass rate</p>
                <p className="text-2xl text-gray-900">{quizState.data.passRate}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Avg score</p>
                <p className="text-2xl text-gray-900">{quizState.data.avgScore}%</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Win log */}
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-6 space-y-4">
          <h3 className="text-gray-900">Recent wins</h3>
          {winsState.error && <ErrorState message={winsState.error} />}
          {winsState.loading && <SectionSkeleton rows={4} />}
          {!winsState.loading && winsState.data && (
            <div className="space-y-3">
              {winsState.data.entries.map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-gray-900">
                      {typeof entry.details === 'string' ? entry.details : (typeof entry.awarded === 'string' ? entry.awarded : "Momentum boost")}
                    </p>
                    {entry.awardedBy && (
                      <p className="text-xs text-gray-400 mt-1">
                        Awarded by: {entry.awardedBy}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {entry.timestamp ? new Date(entry.timestamp).toString() : "Recently"}
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    +{entry.value || entry.streak || 0} XP
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
