const path = require("path");
const fs = require("fs");
const { CosmosClient } = require("@azure/cosmos");

const envFile = path.join(__dirname, "../env/.env.dev");
if (fs.existsSync(envFile)) {
  require("dotenv").config({ path: envFile });
} else {
    const rootEnv = path.join(__dirname, "../.env");
    if (fs.existsSync(rootEnv)) {
        require("dotenv").config({ path: rootEnv });
    }
}

const client = new CosmosClient({
    endpoint: process.env.COSMOS_ENDPOINT,
    key: process.env.COSMOS_KEY,
});

async function findManagers() {
    const db = client.database(process.env.COSMOS_DATABASE || "ChatBotDB");
    const container = db.container("users");

    console.log("Searching for 'Anisha' and 'Priyanka'...");

    const querySpec = {
        query: "SELECT c.id, c.name, c.email FROM c WHERE CONTAINS(LOWER(c.name), 'anisha') OR CONTAINS(LOWER(c.name), 'priyanka')"
    };

    const { resources } = await container.items.query(querySpec).fetchAll();
    
    if (resources.length === 0) {
        console.log("No existing users found matching 'Anisha' or 'Priyanka'.");
    } else {
        console.log("Found users:", JSON.stringify(resources, null, 2));
    }
}

findManagers().catch(console.error);
