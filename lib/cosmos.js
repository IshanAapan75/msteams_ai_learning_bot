import { CosmosClient } from "@azure/cosmos";

let cosmosClient;
let cosmosDatabase;

function ensureDatabase() {
  if (cosmosDatabase) {
    return cosmosDatabase;
  }

  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;

  if (!endpoint || !key) {
    throw new Error(
      "COSMOS_ENDPOINT and COSMOS_KEY must be configured before accessing Cosmos containers."
    );
  }

  cosmosClient = new CosmosClient({ endpoint, key });
  cosmosDatabase = cosmosClient.database(process.env.COSMOS_DATABASE || "ChatBotDB");
  return cosmosDatabase;
}

function getContainer(name) {
  return ensureDatabase().container(name);
}

const containerNames = [
  "users",
  "quizzes",
  "questions",
  "responses",
  "teams",
  "badges",
  "conversations",
  "ai_learning",
  "rewards",
  "userusage",
  "assessmentquestion",
  "assessmentresponse",
];

const containerAliases = {
  micro_learning: "ai_learning",
};

export const containers = containerNames.reduce((acc, name) => {
  Object.defineProperty(acc, name, {
    enumerable: true,
    get() {
      return getContainer(name);
    },
  });
  return acc;
}, {});

Object.entries(containerAliases).forEach(([alias, target]) => {
  if (containers[alias]) {
    return;
  }
  Object.defineProperty(containers, alias, {
    enumerable: true,
    get() {
      return getContainer(target);
    },
  });
});

export function resetCosmosClient() {
  cosmosClient = undefined;
  cosmosDatabase = undefined;
}
