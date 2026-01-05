"use strict";

require("dotenv").config({ path: process.env.DOTENV_CONFIG || "./env/.env.dev" });

const fs = require("fs");
const path = require("path");
const { containers } = require("../lib/cosmos");

const SPEC_PATH = path.resolve(process.cwd(), "Micro Learning");

const COLOR_TO_TIER = {
  "🟢": "AI Rookie",
  "🟡": "AI Learner",
  "🔵": "AI Explorer",
};

function sliceBetween(body, startToken, endTokens) {
  const start = body.indexOf(startToken);
  if (start === -1) {
    return null;
  }
  const fromStart = body.slice(start + startToken.length);
  let endIndex = fromStart.length;
  for (const token of endTokens) {
    const idx = fromStart.indexOf(token);
    if (idx !== -1 && idx < endIndex) {
      endIndex = idx;
    }
  }
  return fromStart.slice(0, endIndex).trim();
}

function collapseWhitespace(str = "") {
  return str
    .replace(/\s+/g, " ")
    .replace(/“/g, '"')
    .replace(/”/g, '"')
    .trim();
}

function parseMicroLearningSection(section) {
  if (!section) {
    return { headline: "", bullets: [] };
  }
  const lines = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const headline = lines.shift() || "";
  const bullets = lines
    .map((line) => line.replace(/^[-•●]\s*/, "").trim())
    .filter(Boolean);
  return { headline: collapseWhitespace(headline), bullets };
}

function parseAssessment(section) {
  if (!section) {
    return null;
  }
  const lines = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const questionLines = [];
  const options = [];
  const coaching = { correct: [], incorrect: [] };
  let mode = "question";
  for (const line of lines) {
    if (/^Coaching/i.test(line)) {
      mode = "coaching";
      continue;
    }
    if (/^[A-D]\.\s*/.test(line)) {
      mode = "options";
    }

    if (mode === "question" && !/^[A-D]\.\s*/.test(line)) {
      questionLines.push(line);
      continue;
    }

    if (mode === "options") {
      const match = /^([A-D])\.\s*(.+)$/.exec(line);
      if (match) {
        const [, label, rawText] = match;
        const plain = rawText.replace(/✅|❌/g, "").trim();
        const correct = rawText.includes("✅");
        options.push({ label, text: collapseWhitespace(plain), correct });
        continue;
      }
    }

    if (mode === "coaching") {
      const normalized = line.replace(/^[-•●]\s*/, "").trim();
      if (!normalized) {
        continue;
      }
      if (normalized.includes("✅")) {
        coaching.correct.push(collapseWhitespace(normalized.replace("✅", "").replace(/^Correct:?\s*/i, "")));
      } else if (normalized.includes("❌")) {
        coaching.incorrect.push(collapseWhitespace(normalized.replace("❌", "").replace(/^Not\s+quite:?\s*/i, "")));
      } else {
        coaching.incorrect.push(collapseWhitespace(normalized));
      }
    }
  }

  const question = collapseWhitespace(questionLines.join(" "));
  const correctOption = options.find((opt) => opt.correct) || options[0];
  return {
    question,
    options,
    correctAnswer: correctOption ? correctOption.text : "",
    coaching,
  };
}

function parseUsageSection(section) {
  if (!section) {
    return [];
  }
  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("🧾"))
    .map((line) => line.replace(/^[-•●]\s*/, ""));
}

function parseMicrolearningSpec(specPath) {
  const raw = fs.readFileSync(specPath, "utf-8").replace(/\r\n/g, "\n");
  const chunks = raw.split(/(?=^[🟢🟡🔵]\s+DAY\s+\d+)/gim).map((chunk) => chunk.trim()).filter(Boolean);
  const modules = [];

  for (const chunk of chunks) {
    const headerMatch = /^([🟢🟡🔵])\s+DAY\s+(\d+)([^\n]*)/i.exec(chunk);
    if (!headerMatch) {
      continue;
    }
    const [, icon, dayStr] = headerMatch;
    const day = Number(dayStr);
    const tier = COLOR_TO_TIER[icon] || "AI Rookie";
    const body = chunk.slice(headerMatch[0].length).trim();
    const firstLine = body.split("\n").map((line) => line.trim()).filter(Boolean)[0] || "";

    const microLearningSection = parseMicroLearningSection(
      sliceBetween(body, "📘 Micro-learning", ["Example prompt", "❓ Micro-assessment"])
    );

    const examplePrompt = collapseWhitespace(
      sliceBetween(body, "Example prompt", ["❓ Micro-assessment", "🎯 Micro-action"])
    );

    const assessment = parseAssessment(
      sliceBetween(body, "❓ Micro-assessment", ["🎯 Micro-action", "🧾", "🌡", "🔥", "🟢 DAY", "🟡 DAY", "🔵 DAY"])
    );

    const microAction = collapseWhitespace(
      sliceBetween(body, "🎯 Micro-action", ["🧾", "🌡", "🔥", "🟢 DAY", "🟡 DAY", "🔵 DAY"])
    );

    const usageLogFields = parseUsageSection(
      sliceBetween(body, "🧾", ["🌡", "🔥", "🟢 DAY", "🟡 DAY", "🔵 DAY"])
    );

    modules.push({
      id: `micro-learning-day-${day}`,
      icon,
      day,
      tier,
      topic: firstLine,
      headline: microLearningSection.headline,
      bullets: microLearningSection.bullets,
      examplePrompt,
      assessment,
      microAction,
      usageLogFields,
    });
  }

  return modules.sort((a, b) => a.day - b.day);
}

function ensureModuleIntegrity(modules) {
  if (!modules.length) {
    throw new Error("No microlearning modules parsed. Check the spec file formatting.");
  }
  const missingAssessment = modules.filter((mod) => !mod.assessment || !mod.assessment.correctAnswer);
  if (missingAssessment.length) {
    const days = missingAssessment.map((mod) => mod.day).join(", ");
    throw new Error(`Missing assessment parsing for days: ${days}`);
  }
}

async function seedMicroLearning() {
  if (!fs.existsSync(SPEC_PATH)) {
    throw new Error(`Micro Learning spec not found at ${SPEC_PATH}`);
  }

  const modules = parseMicrolearningSpec(SPEC_PATH);
  ensureModuleIntegrity(modules);

  console.log(`Parsed ${modules.length} microlearning modules. Seeding Cosmos DB...`);

  const exportedModules = [];

  for (const module of modules) {
    const quizId = `${module.id}-quiz`;
    const questionId = `${module.id}-question`;

    const questionDoc = {
      id: questionId,
      type: "mcq",
      text: module.assessment.question,
      options: module.assessment.options.map((opt) => opt.text),
      correctAnswer: module.assessment.correctAnswer,
      xp: 5,
      tier: module.tier,
      coaching: module.assessment.coaching,
    };

    const quizDoc = {
      id: quizId,
      title: module.topic,
      description: module.headline,
      difficulty: module.tier,
      questions: [questionId],
      estimatedTime: 2,
    };

    const learningDoc = {
      id: module.id,
      order: module.day,
      day: module.day,
      tier: module.tier,
      topic: module.topic,
      title: module.topic,
      description: module.headline,
      details: module.bullets.join(" \n"),
      level: module.tier,
      examplePrompt: module.examplePrompt,
      microAction: module.microAction,
      usageLogFields: module.usageLogFields,
      rewards: 5,
      status: "not started",
      quizzes: [quizId],
      metadata: {
        source: "micro-learning-spec",
      },
    };

    await containers.questions.items.upsert(questionDoc);
    await containers.quizzes.items.upsert(quizDoc);
    await containers.micro_learning.items.upsert(learningDoc);

    exportedModules.push({
      ...learningDoc,
      quizId,
      questionId,
    });

    console.log(`Seeded ${module.id}`);
  }

  const exportPath = path.resolve(process.cwd(), "data/microlearning.json");
  fs.writeFileSync(
    exportPath,
    JSON.stringify(
      {
        source: "Micro Learning",
        generatedAt: new Date().toISOString(),
        total: exportedModules.length,
        modules: exportedModules,
      },
      null,
      2
    )
  );
  console.log(`Exported structured modules to ${exportPath}`);

  console.log("Microlearning content seeding complete.");
}

seedMicroLearning().catch((error) => {
  console.error("Failed to seed microlearning content", error);
  process.exit(1);
});
