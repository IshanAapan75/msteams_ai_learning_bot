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

async function checkCatalog() {
    const db = client.database(process.env.COSMOS_DATABASE || "ChatBotDB");
    const container = db.container("ai_learning");

    console.log("Checking AI Learning Catalog...");

    const { resources } = await container.items.query("SELECT c.id, c.title, c[\"order\"], c.tier FROM c ORDER BY c[\"order\"] ASC").fetchAll();
    
    console.log(JSON.stringify(resources, null, 2));
}

checkCatalog().catch(console.error);
