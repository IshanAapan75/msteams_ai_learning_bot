import { CosmosClient } from "@azure/cosmos";

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});

const database = client.database(process.env.COSMOS_DATABASE || "ChatBotDB");

export const containers = {
  users: database.container("users"),
  quizzes: database.container("quizzes"),
  questions: database.container("questions"),
  responses: database.container("responses"),
  teams: database.container("teams"),
};
