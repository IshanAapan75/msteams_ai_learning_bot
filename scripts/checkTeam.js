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

const TEAM_ID = "0ecb4985-cb3b-40b5-a4bd-6f4538b82987";

async function checkTeam() {
    const db = client.database(process.env.COSMOS_DATABASE || "ChatBotDB");
    const container = db.container("teams");

    console.log(`Checking for team ID: ${TEAM_ID}`);

    try {
        const { resource } = await container.item(TEAM_ID, TEAM_ID).read();
        if (resource) {
            console.log("Team found:", JSON.stringify(resource, null, 2));
        } else {
            console.log("Team not found via point read.");
            // Try query
            const querySpec = {
                query: "SELECT * FROM c WHERE c.id = @id",
                parameters: [{ name: "@id", value: TEAM_ID }]
            };
            const { resources } = await container.items.query(querySpec).fetchAll();
            if (resources.length > 0) {
                console.log("Team found via query:", JSON.stringify(resources[0], null, 2));
            } else {
                console.log("Team not found via query either.");
            }
        }
    } catch (err) {
        console.error("Error checking team:", err.message);
    }
}

checkTeam().catch(console.error);
