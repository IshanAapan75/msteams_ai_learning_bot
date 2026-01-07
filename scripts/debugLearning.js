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

const USER_ID = "29:1VJWyPGd7kC35tSypp-Q4rt3-PEmcL75drhwwBhZyjTutBIXnGltXj8Nagh8iwEpYNeAE6kDZsodqjoLKJA4Hxg";

async function debugLearning() {
    const db = client.database(process.env.COSMOS_DATABASE || "ChatBotDB");
    const container = db.container("responses");

    console.log(`Checking responses for user: ${USER_ID}`);

    const querySpec = {
        query: "SELECT * FROM c WHERE c.userId = @userId",
        parameters: [{ name: "@userId", value: USER_ID }]
    };

    const { resources } = await container.items.query(querySpec).fetchAll();
    
    if (resources.length === 0) {
        console.log("No response documents found for this user.");
    } else {
        console.log(`Found ${resources.length} documents.`);
        resources.forEach((doc, idx) => {
            console.log(`--- Document ${idx + 1} ---`);
            console.log(JSON.stringify(doc, null, 2));
        });
    }
}

debugLearning().catch(console.error);
