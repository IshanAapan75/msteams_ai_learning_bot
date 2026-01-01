import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Target,
  Clock,
  TrendingUp,
  CheckCircle2,
  ChevronDown,
  Building2,
  AlertCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  Tooltip,
} from "recharts";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { SectionSkeleton } from "../components/analytics/LoadingBlocks";
import { analyticsService } from "../services/analytics";
import type { HabitsResponse, TeamAnalyticsResponse, TrendResponse } from "../types/analytics";
import { authService } from "../services/auth";
import { useNavigate } from "react-router-dom";

function formatTimestamp(value?: string | null) {
  if (!value) return "Never";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  } catch (error) {
    return value;
  }
}

function MetricSkeleton() {
  return (
    <Card className="border-gray-200 shadow-sm">
      <CardContent className="p-6">
        <Skeleton className="h-4 w-24 mb-4" />
        <Skeleton className="h-8 w-20" />
      </CardContent>
    </Card>
  );
}

export function TeamDashboard() {
  const navigate = useNavigate();
  const session = authService.getSession();
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [teamState, setTeamState] = useState<{
    data: TeamAnalyticsResponse | null;
    loading: boolean;
    error: string | null;
  }>({ data: null, loading: true, error: null });
  const [trendState, setTrendState] = useState<{
    data: TrendResponse | null;
    loading: boolean;
    error: string | null;
  }>({ data: null, loading: true, error: null });
  const [habitsState, setHabitsState] = useState<{
    data: HabitsResponse | null;
    loading: boolean;
    error: string | null;
  }>({ data: null, loading: true, error: null });
  const [teamNameMap, setTeamNameMap] = useState<Record<string, string>>({});
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);

  useEffect(() => {
    if (!session) {
      navigate("/sign-in");
    }
  }, [session, navigate]);

  useEffect(() => {
    if (!session) {
      return;
    }
    let active = true;
    setTeamState((prev) => ({ ...prev, loading: true, error: null }));

    analyticsService
      .getTeam(teamFilter ? { teamId: teamFilter } : undefined)
      .then((data) => {
        if (!active) return;
        setTeamState({ data, loading: false, error: null });
        setTeamNameMap((prev) => ({ ...prev, [data.team.id]: data.team.name }));
      })
      .catch((error) => {
        if (!active) return;
        setTeamState({ data: null, loading: false, error: error.message || "Failed to load team analytics" });
      });

    return () => {
      active = false;
    };
  }, [teamFilter]);

  const currentTeamId = teamState.data?.team.id;

  useEffect(() => {
    if (!currentTeamId) {
      setTrendState((prev) => ({ ...prev, data: null }));
      return;
    }
    let active = true;
    setTrendState({ data: null, loading: true, error: null });
    analyticsService
      .getTrend({ scope: "team", teamId: currentTeamId, range: 21 })
      .then((data) => {
        if (!active) return;
        setTrendState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (!active) return;
        setTrendState({ data: null, loading: false, error: error.message || "Failed to load activity trend" });
      });
    return () => {
      active = false;
    };
  }, [currentTeamId]);

  useEffect(() => {
    if (!currentTeamId) {
      setHabitsState((prev) => ({ ...prev, data: null }));
      return;
    }
    let active = true;
    setHabitsState({ data: null, loading: true, error: null });
    analyticsService
      .getHabits({ scope: "team", teamId: currentTeamId })
      .then((data) => {
        if (!active) return;
        setHabitsState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (!active) return;
        setHabitsState({ data: null, loading: false, error: error.message || "Failed to load fluency components" });
      });
    return () => {
      active = false;
    };
  }, [currentTeamId]);

  const accessibleTeams = useMemo(() => {
    const ids = teamState.data?.accessibleTeams || [];
    const current = teamState.data?.team.id ? [teamState.data.team.id] : [];
    return Array.from(new Set([...current, ...ids])).filter(Boolean);
  }, [teamState.data]);

  const teamName = teamState.data?.team.name || "Team";
  const teamStats = teamState.data?.team;
  const members = teamState.data?.members || [];

  const memberChartData = useMemo(
    () =>
      members
        .slice()
        .sort((a, b) => (b.xp || 0) - (a.xp || 0))
        .map((member) => ({ name: member.name, xp: member.xp || 0, streak: member.streak || 0 })),
    [members]
  );

  const habitChartData = useMemo(() => {
    const components = habitsState.data?.components || {};
    return Object.entries(components).map(([key, value]) => ({
      key,
      label: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
      value,
    }));
  }, [habitsState.data]);

  const trendSeries = trendState.data?.series || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900">Team Dashboard</h2>
        <p className="text-gray-600 mt-1">Track your team's AI transformation progress</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <button
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            onClick={() => setShowTeamDropdown((open) => !open)}
            disabled={teamState.loading}
          >
            <Building2 className="w-4 h-4" />
            {teamName}
            <ChevronDown className="w-4 h-4" />
          </button>
          {showTeamDropdown && (
            <div className="absolute left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              {accessibleTeams.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-500">No managed teams</div>
              )}
              {accessibleTeams.map((teamId) => (
                <button
                  key={teamId}
                  className={`block px-4 py-2 text-gray-900 hover:bg-gray-100 w-full text-left first:rounded-t-lg last:rounded-b-lg ${
                    teamFilter === teamId || (!teamFilter && teamState.data?.team.id === teamId)
                      ? "bg-blue-50 text-blue-700"
                      : ""
                  }`}
                  onClick={() => {
                    setTeamFilter(teamId === teamState.data?.team.id ? null : teamId);
                    setShowTeamDropdown(false);
                  }}
                >
                  {teamNameMap[teamId] || (teamState.data?.team.id === teamId ? teamName : teamId)}
                </button>
              ))}
            </div>
          )}
        </div>
        {teamState.error && (
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle className="w-4 h-4" />
            {teamState.error}
          </div>
        )}
      </div>

      <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 shadow-md">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Organization Momentum Score</p>
                <p className="text-5xl text-gray-900">
                  {trendState.loading || !trendSeries.length
                    ? "—"
                    : Math.max(10, Math.round(trendSeries.reduce((acc, point) => acc + point.xpEarned, 0) / (trendSeries.length || 1)))}
                </p>
              </div>
            </div>
            <div className="text-center md:text-right">
              <p className="text-sm text-gray-600">
                {trendState.loading || !trendState.data
                  ? "Calculating recent activity"
                  : `Tracking last ${trendState.data.rangeDays} days`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {teamState.loading && [0, 1, 2, 3, 4].map((key) => <MetricSkeleton key={key} />)}
        {!teamState.loading && teamStats && (
          <>
            <Card className="border-gray-200 shadow-sm">
              <CardContent className="p-6">
                <p className="text-sm text-gray-600 mb-2">Participants</p>
                <p className="text-4xl text-gray-900 mb-1">{teamStats.memberCount}</p>
                <p className="text-sm text-gray-500">{members.length} tracked members</p>
              </CardContent>
            </Card>
            <Card className="border-gray-200 shadow-sm">
              <CardContent className="p-6">
                <p className="text-sm text-gray-600 mb-2">Total XP</p>
                <p className="text-4xl text-gray-900 mb-1">{teamStats.totalXp.toLocaleString()}</p>
                <p className="text-sm text-gray-500">All time</p>
              </CardContent>
            </Card>
            <Card className="border-gray-200 shadow-sm">
              <CardContent className="p-6">
                <p className="text-sm text-gray-600 mb-2">Avg Streak</p>
                <p className="text-4xl text-gray-900 mb-1">{teamStats.avgStreak}</p>
                <p className="text-sm text-gray-500">Max {teamStats.maxStreak}</p>
              </CardContent>
            </Card>
            <Card className="border-gray-200 shadow-sm">
              <CardContent className="p-6">
                <p className="text-sm text-gray-600 mb-2">Last Activity</p>
                <p className="text-2xl text-gray-900 mb-1">
                  {formatTimestamp(teamStats.lastActive)}
                </p>
                <p className="text-sm text-gray-500">Most recent logged action</p>
              </CardContent>
            </Card>
            <Card className="border-gray-200 shadow-sm">
              <CardContent className="p-6">
                <p className="text-sm text-gray-600 mb-2">Accessible Teams</p>
                <p className="text-4xl text-gray-900 mb-1">{accessibleTeams.length}</p>
                <p className="text-sm text-gray-500">Managed by you</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-violet-50 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Team Momentum Score</p>
                <p className="text-5xl text-gray-900">
                  {teamStats
                    ? Math.max(10, Math.round(teamStats.totalXp / Math.max(teamStats.memberCount, 1) + teamStats.avgStreak * 5))
                    : "—"}
                </p>
              </div>
            </div>
            <div className="hidden sm:block text-right">
              <p className="text-sm text-gray-600 mb-1">Based on XP per member & streak health</p>
              <p className="text-xs text-gray-500">Updated whenever analytics refresh</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-gray-900">XP by member</h3>
              <span className="text-sm text-gray-500">Top performers</span>
            </div>
            {teamState.loading ? (
              <SectionSkeleton rows={5} />
            ) : memberChartData.length ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={memberChartData} layout="vertical" margin={{ left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={{ stroke: "#e5e7eb" }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                    axisLine={{ stroke: "#e5e7eb" }}
                    width={120}
                  />
                  <Bar dataKey="xp" radius={[0, 8, 8, 0]}>
                    {memberChartData.map((entry, index) => (
                      <Cell key={`cell-${entry.name}`} fill={index === 0 ? "#6366f1" : "#2563eb"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-500">No member data found</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-gray-900">Team activity trend</h3>
              <span className="text-sm text-gray-500">XP added per day</span>
            </div>
            {trendState.loading ? (
              <SectionSkeleton rows={5} />
            ) : trendSeries.length ? (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={trendSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={{ stroke: "#e5e7eb" }} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={{ stroke: "#e5e7eb" }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, borderColor: "#e5e7eb" }}
                    formatter={(value: number) => [`${value} XP`, "XP earned"]}
                  />
                  <Line type="monotone" dataKey="xpEarned" stroke="#2563eb" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-500">No trend data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-gray-900">Fluency components</h3>
            <span className="text-sm text-gray-500">Average scores across team</span>
          </div>
          {habitsState.loading ? (
            <SectionSkeleton rows={4} />
          ) : habitChartData.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={habitChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 12 }} />
                <YAxis dataKey="label" type="category" tick={{ fill: "#6b7280", fontSize: 12 }} width={140} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-500">No habit data found</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-6">
          <h3 className="text-gray-900 mb-4">Team roster</h3>
          {teamState.loading ? (
            <SectionSkeleton rows={5} />
          ) : members.length ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm text-gray-600">Name</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-600">XP</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-600">Streak</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-600">Last active</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4 text-gray-900">{member.name}</td>
                      <td className="py-4 px-4 text-gray-900">{member.xp.toLocaleString()} XP</td>
                      <td className="py-4 px-4 text-gray-900">{member.streak} days</td>
                      <td className="py-4 px-4 text-gray-900">{formatTimestamp(member.lastActionDate)}</td>
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs">
                          <CheckCircle2 className="w-3 h-3" />
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No members tracked for this team</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
