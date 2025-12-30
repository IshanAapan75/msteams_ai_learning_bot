/**
 * Seed script that populates Cosmos DB with rich sample data so the analytics dashboards
 * (Teams bot + standalone Vite UI) have everything they need to render.
 *
 * Usage:
 *   node scripts/seedAnalyticsData.js          // assumes COSMOS_* env vars already set
 *   COSMOS_ENDPOINT=... COSMOS_KEY=... node scripts/seedAnalyticsData.js
 */

const path = require("path");
const fs = require("fs");
const { CosmosClient } = require("@azure/cosmos");

const envFile = path.join(__dirname, "../.env");
if (fs.existsSync(envFile)) {
  require("dotenv").config({ path: envFile });
}

const REQUIRED_ENV_VARS = ["COSMOS_ENDPOINT", "COSMOS_KEY", "COSMOS_DATABASE"];

function assertEnv() {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

function createClient() {
  assertEnv();
  return new CosmosClient({
    endpoint: process.env.COSMOS_ENDPOINT,
    key: process.env.COSMOS_KEY,
  });
}

const CONTAINERS = [
  "users",
  "teams",
  "badges",
  "ai_learning",
  "responses",
  "quizzes",
  "questions",
  "rewards",
  "conversations",
];

const now = new Date();
const isoNow = now.toISOString();
const today = isoNow.split("T")[0];
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

const sampleTeams = [
  {
    id: "team-product",
    name: "Product Team",
    totalXP: 12450,
    streak: 24,
    minutesSaved: 1580,
    members: 8,
    momentumScore: 92,
    avgFluency: 76,
    avgConfidence: "High",
    totalLogs: 138,
    timeSaved: 520,
  },
  {
    id: "team-engineering",
    name: "Engineering Team",
    totalXP: 11230,
    streak: 18,
    minutesSaved: 1420,
    members: 12,
    momentumScore: 85,
    avgFluency: 73,
    avgConfidence: "Medium",
    totalLogs: 115,
    timeSaved: 460,
  },
  {
    id: "team-marketing",
    name: "Marketing Team",
    totalXP: 8920,
    streak: 15,
    minutesSaved: 1050,
    members: 7,
    momentumScore: 78,
    avgFluency: 68,
    avgConfidence: "Medium",
    totalLogs: 96,
    timeSaved: 385,
  },
];

const sampleUsers = [
  {
    id: "user-alex",
    name: "Alex Chen",
    email: "alex.chen@example.com",
    teamId: "team-product",
    role: "Product Manager",
    xp: 2450,
    level: 5,
    fluencyScore: 78,
    streak: 12,
    longestStreak: 18,
    minutesSaved: 347,
    confidence: "High",
    badges: ["bronze", "silver", "consistency"],
    createdAt: isoNow,
    updatedAt: isoNow,
  },
  {
    id: "user-sarah",
    name: "Sarah Patel",
    email: "sarah.patel@example.com",
    teamId: "team-engineering",
    role: "Software Engineer",
    xp: 3120,
    level: 6,
    fluencyScore: 82,
    streak: 21,
    longestStreak: 24,
    minutesSaved: 385,
    confidence: "High",
    badges: ["bronze", "silver"],
    createdAt: isoNow,
    updatedAt: isoNow,
  },
  {
    id: "user-jordan",
    name: "Jordan Smith",
    email: "jordan.smith@example.com",
    teamId: "team-product",
    role: "Customer Success",
    xp: 1740,
    level: 4,
    fluencyScore: 70,
    streak: 7,
    longestStreak: 10,
    minutesSaved: 212,
    confidence: "Medium",
    badges: ["bronze"],
    createdAt: isoNow,
    updatedAt: isoNow,
  },
  {
    id: "user-priya",
    name: "Priya Desai",
    email: "priya.desai@example.com",
    teamId: "team-marketing",
    role: "Marketing Lead",
    xp: 1980,
    level: 4,
    fluencyScore: 73,
    streak: 9,
    longestStreak: 14,
    minutesSaved: 268,
    confidence: "Medium",
    badges: ["bronze", "time-saver"],
    createdAt: isoNow,
    updatedAt: isoNow,
  },
];

const sampleLearning = [
  {
    id: "learning-ai-foundations",
    userId: "user-alex",
    topic: "AI Foundations",
    description: "Core concepts of responsible AI usage",
    details: "Covers LLM basics, prompt patterns, and safety checks.",
    level: "Beginner",
    status: "completed",
    rewards: 5,
    quizzes: ["quiz-ai-101"],
    completedAt: isoNow,
  },
  {
    id: "learning-prompt-engineering",
    userId: "user-sarah",
    topic: "Prompt Engineering",
    description: "Design reusable prompt structures for coding copilots",
    level: "Advanced",
    status: "in_progress",
    rewards: 10,
    quizzes: ["quiz-ai-201"],
  },
  {
    id: "learning-ai-usage-tracking",
    userId: "user-jordan",
    topic: "Tracking AI Usage",
    description: "How to log AI wins and measure ROI",
    level: "Intermediate",
    status: "not started",
    rewards: 5,
  },
  {
    id: "learning-storytelling",
    userId: "user-priya",
    topic: "AI Storytelling",
    description: "Experiment with AI to craft narratives",
    level: "Intermediate",
    status: "completed",
    rewards: 8,
    completedAt: yesterday,
  },
];

const sampleQuestions = [
  {
    id: "question-ai-101-1",
    quizId: "quiz-ai-101",
    text: "Which prompt structure works best for summarizing meetings?",
    choices: ["Chain of Thought", "S.C.Q.A.", "Few Shot", "Temperature"],
    correctAnswer: "S.C.Q.A.",
    xp: 5,
    topic: "Prompting",
    difficulty: "easy",
  },
  {
    id: "question-ai-101-2",
    quizId: "quiz-ai-101",
    text: "What is the safest way to share sensitive data with an LLM?",
    choices: ["Mask PII", "Send raw data", "Use email", "Upload CSV"],
    correctAnswer: "Mask PII",
    xp: 5,
    topic: "Safety",
    difficulty: "medium",
  },
  {
    id: "question-ai-201-1",
    quizId: "quiz-ai-201",
    text: "Choose the best follow-up prompt to improve code generated by Copilot.",
    choices: [
      "Rewrite",
      "Explain the algorithm and complexity",
      "Ignore",
      "Switch language",
    ],
    correctAnswer: "Explain the algorithm and complexity",
    xp: 10,
    topic: "Prompt Engineering",
    difficulty: "hard",
  },
];

const sampleQuizzes = [
  {
    id: "quiz-ai-101",
    title: "AI Usage Foundations",
    description: "Covers safe usage patterns and prompt basics",
    difficulty: "Beginner",
    questions: sampleQuestions.filter((q) => q.quizId === "quiz-ai-101").map((q) => q.id),
    estimatedTime: 5,
  },
  {
    id: "quiz-ai-201",
    title: "Prompt Engineering Deep Dive",
    description: "Debug prompts and measure output quality",
    difficulty: "Intermediate",
    questions: sampleQuestions.filter((q) => q.quizId === "quiz-ai-201").map((q) => q.id),
    estimatedTime: 8,
  },
];

const sampleResponses = [
  {
    id: "user-alex",
    userId: "user-alex",
    updatedAt: isoNow,
    learnings: [
      {
        learningId: "learning-ai-foundations",
        status: "completed",
        createdAt: isoNow,
        updatedAt: isoNow,
        attempts: [
          {
            quizId: "quiz-ai-101",
            status: "completed",
            responses: [
              {
                questionId: "question-ai-101-1",
                answer: "S.C.Q.A.",
                correct: true,
                correctAnswer: "S.C.Q.A.",
                xpValue: 5,
                answeredAt: isoNow,
              },
              {
                questionId: "question-ai-101-2",
                answer: "Mask PII",
                correct: true,
                correctAnswer: "Mask PII",
                xpValue: 5,
                answeredAt: isoNow,
              },
            ],
            score: { correct: 2, total: 2 },
            result: "passed",
            xpEarned: 10,
            submittedAt: isoNow,
            completedAt: isoNow,
          },
        ],
      },
    ],
  },
  {
    id: "user-sarah",
    userId: "user-sarah",
    updatedAt: isoNow,
    learnings: [
      {
        learningId: "learning-prompt-engineering",
        status: "in_progress",
        createdAt: isoNow,
        updatedAt: isoNow,
        attempts: [
          {
            quizId: "quiz-ai-201",
            status: "completed",
            responses: [
              {
                questionId: "question-ai-201-1",
                answer: "Explain the algorithm and complexity",
                correct: true,
                correctAnswer: "Explain the algorithm and complexity",
                xpValue: 10,
                answeredAt: isoNow,
              },
            ],
            score: { correct: 1, total: 1 },
            result: "passed",
            xpEarned: 10,
            submittedAt: isoNow,
            completedAt: isoNow,
          },
        ],
      },
    ],
  },
];

const sampleBadges = [
  {
    id: "badge-user-alex-bronze",
    userId: "user-alex",
    badgeName: "bronze",
    awardedAt: isoNow,
  },
  {
    id: "badge-user-alex-consistency",
    userId: "user-alex",
    badgeName: "consistency",
    awardedAt: isoNow,
  },
  {
    id: "badge-user-sarah-silver",
    userId: "user-sarah",
    badgeName: "silver",
    awardedAt: isoNow,
  },
  {
    id: "badge-user-jordan-bronze",
    userId: "user-jordan",
    badgeName: "bronze",
    awardedAt: isoNow,
  },
];

const sampleRewards = [
  {
    id: "user-alex",
    userId: "user-alex",
    xp: 2450,
    fluency: 78,
    streak: 12,
    lastActionDate: today,
    dailyTotals: {
      [today]: { xpBase: 20, multiplier: 1.2, xpAwarded: 24 },
      [yesterday]: { xpBase: 15, multiplier: 1.1, xpAwarded: 16 },
    },
    metadata: [
      {
        awardedBy: "ai usage",
        awarded: "xp",
        value: 10,
        streak: 12,
        multiplier: 1.2,
        timestamp: isoNow,
        details: { task: "Summarized meeting notes" },
      },
    ],
    badges: ["bronze", "silver", "consistency"],
    tier: "AI Explorer",
    fluencyComponents: {
      assessments: 20,
      usage: 18,
      quality: 15,
      confidence: 12,
      consistency: 13,
    },
    updatedAt: isoNow,
  },
  {
    id: "user-sarah",
    userId: "user-sarah",
    xp: 3120,
    fluency: 82,
    streak: 21,
    lastActionDate: today,
    dailyTotals: {
      [today]: { xpBase: 25, multiplier: 1.3, xpAwarded: 33 },
    },
    metadata: [
      {
        awardedBy: "micro-assessment",
        awarded: "xp",
        value: 15,
        streak: 21,
        multiplier: 1.3,
        timestamp: isoNow,
        details: { quizId: "quiz-ai-201" },
      },
    ],
    badges: ["bronze", "silver"],
    tier: "AI Practitioner",
    fluencyComponents: {
      assessments: 28,
      usage: 20,
      quality: 18,
      confidence: 10,
      consistency: 6,
    },
    updatedAt: isoNow,
  },
];

const sampleConversations = [
  {
    id: "conv-user-alex",
    userId: "user-alex",
    threadId: "teams-thread-001",
    transcript: [
      { type: "bot", message: "Hey Alex, ready for today's AI practice?" },
      { type: "user", message: "Yes, give me something around summarizing." },
    ],
    createdAt: isoNow,
  },
];

const seedData = {
  users: sampleUsers,
  teams: sampleTeams,
  badges: sampleBadges,
  ai_learning: sampleLearning,
  responses: sampleResponses,
  quizzes: sampleQuizzes,
  questions: sampleQuestions,
  rewards: sampleRewards,
  conversations: sampleConversations,
};

async function ensureContainers(database) {
  for (const name of CONTAINERS) {
    await database.containers.createIfNotExists({ id: name, partitionKey: "/id" });
  }
}

async function seedContainer(database, containerName, documents = []) {
  if (!documents.length) return;

  const container = database.container(containerName);
  for (const doc of documents) {
    try {
      await container.items.upsert(doc);
      console.log(`[seed] Upserted into ${containerName}:`, doc.id || doc.userId);
    } catch (error) {
      console.error(`[seed] Failed upserting into ${containerName}:`, error.message);
    }
  }
}

async function main() {
  const client = createClient();
  const database = client.database(process.env.COSMOS_DATABASE || "ChatBotDB");

  console.log("Ensuring containers exist...");
  await ensureContainers(database);

  for (const [containerName, docs] of Object.entries(seedData)) {
    console.log(`Seeding container: ${containerName}`);
    await seedContainer(database, containerName, docs);
  }

  console.log("Analytics sample data seeding complete.");
}

main().catch((error) => {
  console.error("Seed script failed", error);
  process.exit(1);
});
