import { Card, CardContent } from "../components/ui/card";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Flame, Trophy, Users, User, TrendingUp } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { analyticsService } from "../services/analytics";
import { authService } from "../services/auth";
import { useAnalyticsData } from "../hooks/useAnalyticsData";
import type { LeaderboardResponse, TrendResponse } from "../types/analytics";
import { SectionSkeleton } from "../components/analytics/LoadingBlocks";
import { ErrorState } from "../components/analytics/DataState";

export function Leaderboard() {
  const navigate = useNavigate();
  const session = authService.getSession();
  const [viewMode, setViewMode] = useState<"team" | "individual">("team");

  useEffect(() => {
    if (!session) {
      navigate("/sign-in");
    }
  }, [session, navigate]);

  if (!session) {
    return null;
  }

  const leaderboardTeams = useAnalyticsData<LeaderboardResponse>(() =>
    analyticsService.getLeaderboard({ type: "teams", limit: 5 })
  );
  const leaderboardUsers = useAnalyticsData<LeaderboardResponse>(() =>
    analyticsService.getLeaderboard({ type: "users", limit: 5 })
  );
  const orgTrendState = useAnalyticsData<TrendResponse>(() => analyticsService.getOrgTrend({ range: 14 }));

  const orgMomentumScore = useMemo(() => {
    if (!orgTrendState.data) return 0;
    const total = orgTrendState.data.series.reduce((sum, point) => sum + point.xpEarned, 0);
    return Math.round(total / (orgTrendState.data.rangeDays || 1));
  }, [orgTrendState.data]);

  const getRankColor = (rank: number) => {
    if (rank === 1) return "from-yellow-300 to-amber-400";
    if (rank === 2) return "from-gray-300 to-gray-400";
    if (rank === 3) return "from-orange-300 to-orange-400";
    return "from-gray-200 to-gray-300";
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return "🏆";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900">Leaderboard</h2>
        <p className="text-gray-600 mt-1">See how teams and individuals are transforming with AI</p>
      </div>

      <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 shadow-sm">
        <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Org Momentum Score</p>
              <p className="text-4xl text-gray-900">{orgTrendState.loading ? "—" : orgMomentumScore}</p>
            </div>
          </div>
          <div className="text-center md:text-right w-full md:w-auto">
            {orgTrendState.error && <ErrorState message={orgTrendState.error} />}
            {!orgTrendState.loading && orgTrendState.data && (
              <p className="text-sm text-gray-600">Based on {orgTrendState.data.rangeDays} days of XP growth</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 w-fit shadow-sm">
        <button
          onClick={() => setViewMode("team")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-md transition-all ${
            viewMode === "team" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <Users className="w-4 h-4" />
          <span className="text-sm">Team Rankings</span>
        </button>
        <button
          onClick={() => setViewMode("individual")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-md transition-all ${
            viewMode === "individual" ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <User className="w-4 h-4" />
          <span className="text-sm">Individual Rankings</span>
        </button>
      </div>

      {viewMode === "team" && (
        <div className="space-y-3">
          {leaderboardTeams.error && <ErrorState message={leaderboardTeams.error} />}
          {leaderboardTeams.loading && <SectionSkeleton rows={4} />}
          {!leaderboardTeams.loading && leaderboardTeams.data &&
            leaderboardTeams.data.entries.map((team, idx) => {
              const rank = idx + 1;
              const topScore =
                leaderboardTeams.data.entries[0]?.score || leaderboardTeams.data.entries[0]?.totalXP || 1;
              const teamScore = (team as any).score || (team as any).totalXP || 0;
              const barWidth = topScore ? (teamScore / topScore) * 100 : 0;
              const initials = team.name
                .split(" ")
                .map((word: string) => word[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              return (
                <Card key={team.id} className="border-gray-200 shadow-sm hover:shadow-md transition-all">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getRankColor(rank)} flex items-center justify-center flex-shrink-0 shadow-sm`}
                      >
                        <span className="text-lg">{getRankIcon(rank)}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                            <span className="text-sm">{initials}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-900 truncate">{team.name}</p>
                          </div>
                        </div>

                        <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="absolute h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>

                      <div className="hidden sm:flex items-center gap-6 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Momentum</p>
                          <div className="flex items-center gap-1.5">
                            <TrendingUp className="w-4 h-4 text-violet-500" />
                            <p className="text-gray-900">{Math.round(teamScore / 100)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">XP</p>
                          <p className="text-gray-900">{teamScore.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-orange-500" />
                          <p className="text-gray-900">#{rank}</p>
                        </div>
                      </div>

                      <div className="flex sm:hidden flex-col items-end gap-1">
                        <Badge variant="secondary" className="bg-violet-50 text-violet-700 border-violet-200">
                          {Math.round(teamScore / 100)} Momentum
                        </Badge>
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                          {teamScore.toLocaleString()} XP
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}

      {viewMode === "individual" && (
        <>
          <div className="flex items-center justify-between px-1">
            <p className="text-sm text-gray-500">Showing top performers</p>
          </div>
          {leaderboardUsers.error && <ErrorState message={leaderboardUsers.error} />}
          {leaderboardUsers.loading && <SectionSkeleton rows={4} />}
          {!leaderboardUsers.loading && leaderboardUsers.data && (
            <div className="space-y-3">
              {leaderboardUsers.data.entries.map((person, idx) => {
                const rank = idx + 1;
                const maxXP = leaderboardUsers.data.entries[0]?.xp || 1;
                const xp = (person as any).xp || 0;
                const streak = (person as any).streak || 0;
                const barWidth = maxXP ? (xp / maxXP) * 100 : 0;
                const name = person.name || person.id;
                const initials = name
                  .split(" ")
                  .map((word: string) => word[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <Card key={person.id} className="border-gray-200 shadow-sm hover:shadow-md transition-all">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getRankColor(rank)} flex items-center justify-center flex-shrink-0 shadow-sm`}
                        >
                          <span className="text-lg">{getRankIcon(rank)}</span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <Avatar className="w-10 h-10 border-2 border-white shadow-sm">
                              <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-400 text-white">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-900 truncate">{name}</p>
                              <p className="text-xs text-gray-500">Top streak: {streak}</p>
                            </div>
                          </div>

                          <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="absolute h-full bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full transition-all duration-500"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>

                        <div className="hidden sm:flex items-center gap-6 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-xs text-gray-500">XP</p>
                            <p className="text-gray-900">{xp.toLocaleString()}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Flame className="w-4 h-4 text-orange-500" />
                            <p className="text-gray-900">{streak}</p>
                          </div>
                        </div>

                        <div className="flex sm:hidden flex-col items-end gap-1">
                          <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                            {xp.toLocaleString()} XP
                          </Badge>
                          <Badge variant="secondary" className="bg-gray-50 text-gray-700">
                            {streak} day streak
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
