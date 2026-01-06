const path = require("path");
const fs = require("fs");
const { CosmosClient } = require("@azure/cosmos");

const envFile = path.join(__dirname, "../env/.env.dev");
if (fs.existsSync(envFile)) {
  require("dotenv").config({ path: envFile });
} else {
    // Fallback to root .env
    const rootEnv = path.join(__dirname, "../.env");
    if (fs.existsSync(rootEnv)) {
        require("dotenv").config({ path: rootEnv });
    }
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

const now = new Date();
const isoNow = now.toISOString();

// 2-3 Teams
const teams = [
  {
    id: "team-alpha",
    name: "Alpha Squad",
    score: 15600,
    totalXP: 15600,
    memberCount: 3,
    avgStreak: 12,
    maxStreak: 25,
    lastActive: isoNow,
  },
  {
    id: "team-beta",
    name: "Beta Innovators",
    score: 13400,
    totalXP: 13400,
    memberCount: 3,
    avgStreak: 8,
    maxStreak: 15,
    lastActive: isoNow,
  },
  {
    id: "team-gamma",
    name: "Gamma Growth",
    score: 8900,
    totalXP: 8900,
    memberCount: 2,
    avgStreak: 5,
    maxStreak: 10,
    lastActive: isoNow,
  }
];

// 5-8 Users distributed across teams
const users = [
    // Alpha Squad (3)
    {
        id: "user-alice",
        name: "Alice Johnson",
        email: "alice@example.com",
        teamId: "team-alpha",
        role: "Team Lead",
        xp: 6500,
        level: 8,
        fluencyScore: 92,
        streak: 25,
        lastSeenAt: isoNow,
        createdAt: isoNow,
        updatedAt: isoNow
    },
    {
        id: "user-bob",
        name: "Bob Smith",
        email: "bob@example.com",
        teamId: "team-alpha",
        role: "Senior Dev",
        xp: 5200,
        level: 7,
        fluencyScore: 88,
        streak: 10,
        lastSeenAt: isoNow,
        createdAt: isoNow,
        updatedAt: isoNow
    },
    {
        id: "user-charlie",
        name: "Charlie Davis",
        email: "charlie@example.com",
        teamId: "team-alpha",
        role: "Product Owner",
        xp: 3900,
        level: 6,
        fluencyScore: 81,
        streak: 2,
        lastSeenAt: isoNow,
        createdAt: isoNow,
        updatedAt: isoNow
    },
    // Beta Innovators (3)
    {
        id: "user-david",
        name: "David Lee",
        email: "david@example.com",
        teamId: "team-beta",
        role: "Designer",
        xp: 5800,
        level: 7,
        fluencyScore: 85,
        streak: 15,
        lastSeenAt: isoNow,
        createdAt: isoNow,
        updatedAt: isoNow
    },
    {
        id: "user-eve",
        name: "Eve Miller",
        email: "eve@example.com",
        teamId: "team-beta",
        role: "Developer",
        xp: 4200,
        level: 6,
        fluencyScore: 79,
        streak: 7,
        lastSeenAt: isoNow,
        createdAt: isoNow,
        updatedAt: isoNow
    },
    {
        id: "user-frank",
        name: "Frank Wilson",
        email: "frank@example.com",
        teamId: "team-beta",
        role: "QA",
        xp: 3400,
        level: 5,
        fluencyScore: 75,
        streak: 3,
        lastSeenAt: isoNow,
        createdAt: isoNow,
        updatedAt: isoNow
    },
    // Gamma Growth (2)
    {
        id: "user-grace",
        name: "Grace Taylor",
        email: "grace@example.com",
        teamId: "team-gamma",
        role: "Marketing",
        xp: 5100,
        level: 6,
        fluencyScore: 82,
        streak: 8,
        lastSeenAt: isoNow,
        createdAt: isoNow,
        updatedAt: isoNow
    },
    {
        id: "user-henry",
        name: "Henry Clark",
        email: "henry@example.com",
        teamId: "team-gamma",
        role: "Sales",
        xp: 3800,
        level: 5,
        fluencyScore: 76,
        streak: 2,
        lastSeenAt: isoNow,
        createdAt: isoNow,
        updatedAt: isoNow
    }
];

// Rewards Data (Synced with User XP)
const rewards = users.map(u => ({
    id: u.id,
    userId: u.id,
    xp: u.xp,
    fluency: u.fluencyScore,
    streak: u.streak,
    lastActionDate: isoNow.split("T")[0],
    tier: u.level > 7 ? "AI Expert" : u.level > 5 ? "AI Practitioner" : "AI Explorer",
    fluencyComponents: {
        assessments: Math.floor(Math.random() * 30),
        usage: Math.floor(Math.random() * 25),
        quality: Math.floor(Math.random() * 20),
        confidence: Math.floor(Math.random() * 10),
        consistency: Math.floor(Math.random() * 10),
    },
    updatedAt: isoNow
}));

async function seed() {
    console.log("Starting seed...");
    const client = createClient();
    const db = client.database(process.env.COSMOS_DATABASE || "ChatBotDB");

    // Seed Teams
    const teamContainer = db.container("teams");
    for (const team of teams) {
        await teamContainer.items.upsert(team);
        console.log(`Upserted team: ${team.name}`);
    }

    // Seed Users
    const userContainer = db.container("users");
    for (const user of users) {
        await userContainer.items.upsert(user);
        console.log(`Upserted user: ${user.name}`);
    }

    // Seed Rewards
    const rewardContainer = db.container("rewards");
    for (const reward of rewards) {
        await rewardContainer.items.upsert(reward);
        console.log(`Upserted rewards for: ${reward.userId}`);
    }

    console.log("Seeding complete!");
}

seed().catch(console.error);
