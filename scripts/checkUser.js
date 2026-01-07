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

const TARGET_ID = "29:1VJWyPGd7kC35tSypp-Q4rt3-PEmcL75drhwwBhZyjTutBIXnGltXj8Nagh8iwEpYNeAE6kDZsodqjoLKJA4Hxg";

async function checkUser() {
    const db = client.database(process.env.COSMOS_DATABASE || "ChatBotDB");
    const container = db.container("users");

    console.log(`Checking for user ID: ${TARGET_ID}`);

    try {
        const { resource } = await container.item(TARGET_ID, TARGET_ID).read();
        if (resource) {
            console.log("User found:", JSON.stringify(resource, null, 2));
        } else {
            console.log("User not found via point read.");
            // Try query
            const querySpec = {
                query: "SELECT * FROM c WHERE c.id = @id",
                parameters: [{ name: "@id", value: TARGET_ID }]
            };
            const { resources } = await container.items.query(querySpec).fetchAll();
            if (resources.length > 0) {
                console.log("User found via query:", JSON.stringify(resources[0], null, 2));
            } else {
                console.log("User not found via query either.");
            }
        }
    } catch (err) {
        console.error("Error checking user:", err.message);
    }
}

checkUser().catch(console.error);
