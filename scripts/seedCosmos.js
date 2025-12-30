const { CosmosClient } = require("@azure/cosmos");

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
  "responses",
  "teams",
  "badges",
  "conversations",
  "ai_learning",
  "rewards",
];

const seedData = {
  responses: [
    {
      id: "response-user-1",
      userId: "user-1",
      aiLearningId: "learning-module-1",
      aiLearningStatus: "completed",
      attempts: [
        {
          quizId: "quiz-1",
          responses: [
            { questionId: "q1", answer: "A", correct: true, correctAnswer: "A", xpValue: 5 },
            { questionId: "q2", answer: "B", correct: false, correctAnswer: "C", xpValue: 5 },
          ],
          score: { correct: 1, total: 2 },
          result: "needs_review",
          xpEarned: 10,
          submittedAt: new Date().toISOString(),
        },
      ],
    },
  ],
  teams: [
    { id: "team-eng", name: "Engineering", score: 120 },
    { id: "team-mgmt", name: "Management", score: 95 },
  ],
  badges: [
    {
      id: "badge-user-1-bronze",
      userId: "user-1",
      badgeName: "bronze",
      awardedAt: new Date().toISOString(),
    },
  ],
  conversations: [
    {
      id: "conv-user-1",
      userId: "user-1",
      threadId: "thread-123",
      transcript: [
        { type: "bot", message: "Welcome!" },
        { type: "user", message: "start quiz" },
      ],
    },
  ],
  ai_learning: [
    {
      id: "learning-module-1",
      userId: "user-1",
      topic: "Responsible AI",
      description: "Foundations of responsible AI usage",
      level: "Beginner",
      status: "completed",
      completedAt: new Date().toISOString(),
    },
    {
      id: "learning-module-2",
      userId: "user-2",
      topic: "Prompt Engineering",
      description: "Crafting effective prompts for copilots",
      level: "Intermediate",
      status: "in_progress",
    },
  ],
  rewards: [
    {
      id: "user-1",
      userId: "user-1",
      xp: 150,
      fluency: 35,
      streak: 4,
      lastActionDate: new Date().toISOString().split("T")[0],
      dailyTotals: {
        [new Date().toISOString().split("T")[0]]: { xpBase: 10, multiplier: 1.1, xpAwarded: 11 },
      },
      metadata: [
        {
          awardedBy: "quiz",
          awarded: "xp",
          value: 5,
          streak: 4,
          multiplier: 1.1,
          timestamp: new Date().toISOString(),
        },
      ],
      badges: ["bronze"],
      tier: "AI Learner",
      fluencyComponents: {
        assessments: 20,
        usage: 5,
        quality: 5,
        confidence: 3,
        consistency: 2,
      },
      updatedAt: new Date().toISOString(),
    },
  ],
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

  console.log("Seed completed");
}

main().catch((error) => {
  console.error("Seed script failed", error);
  process.exit(1);
});
