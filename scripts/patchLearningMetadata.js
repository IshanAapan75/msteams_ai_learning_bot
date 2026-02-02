const path = require("path");
const fs = require("fs");
const { CosmosClient } = require("@azure/cosmos");

const envCandidates = [
  path.join(__dirname, "../env/.env.dev"),
  path.join(__dirname, "../.env"),
];

for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    require("dotenv").config({ path: candidate });
    break;
  }
}

if (!process.env.COSMOS_ENDPOINT || !process.env.COSMOS_KEY) {
  console.error("Missing Cosmos credentials. Please set COSMOS_ENDPOINT and COSMOS_KEY.");
  process.exit(1);
}

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});

const database = client.database(process.env.COSMOS_DATABASE || "ChatBotDB");
const responsesContainer = database.container("responses");
const learningContainer = database.container("ai_learning");

async function loadLearningModules() {
  const moduleMap = new Map();
  const query = {
    query: "SELECT * FROM c",
  };

  const iterator = learningContainer.items.query(query);
  let total = 0;
  while (true) {
    const { resources, hasMoreResults } = await iterator.fetchNext();
    for (const module of resources) {
      if (module?.id) {
        moduleMap.set(module.id, module);
        total += 1;
      }
    }
    if (!hasMoreResults) {
      break;
    }
  }

  console.log(`[Patch] Loaded ${total} learning modules.`);
  return moduleMap;
}

function normalizeModule(entry, moduleFromCatalog) {
  if (!moduleFromCatalog) {
    if (entry.module) {
      return entry.module;
    }
    return {
      id: entry.learningId,
      topic: entry.topic || entry.title || "Learning module",
      title: entry.title || entry.topic || entry.learningId,
      description: entry.description || "",
      details: entry.details || "",
      level: entry.level || "",
      quizzes: Array.isArray(entry.quizzes) ? entry.quizzes : [],
    };
  }

  return {
    id: moduleFromCatalog.id,
    topic: moduleFromCatalog.topic || moduleFromCatalog.title || moduleFromCatalog.id,
    title: moduleFromCatalog.title || moduleFromCatalog.topic || moduleFromCatalog.id,
    description: moduleFromCatalog.description || "",
    details: moduleFromCatalog.details || "",
    level: moduleFromCatalog.level || "",
    tier: moduleFromCatalog.tier || null,
    order: moduleFromCatalog.order ?? null,
    quizzes: Array.isArray(moduleFromCatalog.quizzes) ? moduleFromCatalog.quizzes : [],
  };
}

function patchLearningEntry(entry, moduleMap, fallbackTimestamp) {
  if (!entry || !entry.learningId) {
    return false;
  }

  let changed = false;
  const catalogModule = moduleMap.get(entry.learningId);
  const normalizedModule = normalizeModule(entry, catalogModule);

  if (!entry.module || JSON.stringify(entry.module) !== JSON.stringify(normalizedModule)) {
    entry.module = normalizedModule;
    changed = true;
  }

  if (!entry.createdAt) {
    entry.createdAt = entry.assignedAt || fallbackTimestamp;
    changed = true;
  }

  if (!entry.updatedAt) {
    entry.updatedAt = entry.createdAt || fallbackTimestamp;
    changed = true;
  }

  if (!entry.availableAt) {
    entry.availableAt = entry.assignedAt || entry.createdAt || fallbackTimestamp;
    changed = true;
  }

  if (!entry.status) {
    entry.status = "available";
    changed = true;
  }

  if (!Array.isArray(entry.attempts)) {
    entry.attempts = [];
    changed = true;
  }

  return changed;
}

async function patchResponseDocuments() {
  const moduleMap = await loadLearningModules();
  const iterator = responsesContainer.items.query({ query: "SELECT * FROM c" });

  let processed = 0;
  let updatedDocs = 0;
  let patchedEntries = 0;

  while (true) {
    const { resources, hasMoreResults } = await iterator.fetchNext();
    for (const doc of resources) {
      processed += 1;
      if (!Array.isArray(doc.learnings) || doc.learnings.length === 0) {
        continue;
      }

      const fallbackTimestamp = doc.updatedAt || doc.createdAt || new Date().toISOString();
      let docChanged = false;

      doc.learnings = doc.learnings.map((entry) => {
        const entryChanged = patchLearningEntry(entry, moduleMap, fallbackTimestamp);
        if (entryChanged) {
          docChanged = true;
          patchedEntries += 1;
        }
        return entry;
      });

      if (docChanged) {
        doc.updatedAt = new Date().toISOString();
        doc.partitionKey = doc.userId;
        doc.id = doc.id || doc.userId;
        await responsesContainer.items.upsert(doc);
        updatedDocs += 1;
        console.log(`[Patch] Updated user ${doc.userId}, doc ${doc.id}`);
      }
    }

    if (!hasMoreResults) {
      break;
    }
  }

  console.log("--- Patch Summary ---");
  console.log(`Documents scanned: ${processed}`);
  console.log(`Documents updated: ${updatedDocs}`);
  console.log(`Learning entries patched: ${patchedEntries}`);
}

patchResponseDocuments()
  .then(() => {
    console.log("Metadata patch complete.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to patch learning metadata", error);
    process.exit(1);
  });
