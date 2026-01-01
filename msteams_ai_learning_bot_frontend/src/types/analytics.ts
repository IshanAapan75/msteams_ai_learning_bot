export type AnalyticsScope = "personal" | "team" | "org";

export interface OverviewResponse {
  scope: AnalyticsScope;
  rangeDays: number;
  user: {
    id: string;
    name: string;
    role?: string;
    teamId?: string | null;
  } | null;
  metrics: {
    totalXp: number;
    level: number;
    streak: number;
    badges: number;
    lastActionDate: string | null;
    nextMilestoneXp: number;
    xpToNextMilestone: number;
  };
  org?: {
    totalXp: number;
    avgStreak: string | number;
    totalUsers: number;
  } | null;
}

export interface TrendPoint {
  date: string;
  xpEarned: number;
}

export interface TrendResponse {
  scope: AnalyticsScope;
  rangeDays: number;
  series: TrendPoint[];
}

export interface HabitsResponse {
  scope: AnalyticsScope;
  teamId?: string;
  components: {
    assessments: number;
    usage: number;
    quality: number;
    confidence: number;
    consistency: number;
  };
}

export interface LearningSummary {
  notStarted: number;
  inProgress: number;
  completed: number;
}

export interface LearningResponse {
  scope: AnalyticsScope;
  teamId?: string;
  summary: LearningSummary;
  recentCompletions: Array<{
    learningId?: string;
    completedAt: string | null;
  }>;
}

export interface QuizAttempt {
  quizId?: string;
  userId: string | null;
  userName?: string | null;
  result?: string;
  status?: string;
  submittedAt?: string | null;
  score?: {
    correct?: number;
    total?: number;
  } | null;
}

export interface QuizResponse {
  scope: AnalyticsScope;
  teamId?: string;
  attempts: number;
  passed: number;
  passRate: number;
  avgScore: number;
  latestAttempts: QuizAttempt[];
}

export interface WinEntry {
  userId: string;
  userName?: string | null;
  awardedBy?: string | null;
  awarded?: string | null;
  value?: number;
  streak?: number;
  multiplier?: number;
  timestamp?: string | null;
  details?: string | null;
}

export interface WinsResponse {
  scope: AnalyticsScope;
  teamId?: string;
  entries: WinEntry[];
}

export interface TeamMemberRecord {
  id: string;
  name: string;
  xp: number;
  streak: number;
  lastActionDate: string | null;
}

export interface TeamAnalyticsResponse {
  team: {
    id: string;
    name: string;
    score: number;
    memberCount: number;
    totalXp: number;
    avgStreak: number;
    maxStreak: number;
    lastActive: string | null;
  };
  members: TeamMemberRecord[];
  accessibleTeams: string[];
}

export interface LeaderboardTeamEntry {
  id: string;
  name: string;
  score?: number;
  totalXP?: number;
}

export interface LeaderboardUserEntry {
  id: string;
  userId?: string;
  name?: string;
  xp?: number;
  streak?: number;
}

export interface LeaderboardResponse {
  type: "teams" | "users";
  entries: Array<LeaderboardTeamEntry | LeaderboardUserEntry>;
}

export interface OrgTrendResponse {
  rangeDays: number;
  series: TrendPoint[];
}
