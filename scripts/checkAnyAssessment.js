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

async function checkAnyAssessment() {
    const db = client.database(process.env.COSMOS_DATABASE || "ChatBotDB");
    const container = db.container("assessmentresponse");

    console.log("Checking for any assessment responses...");

    const { resources } = await container.items.readAll().fetchAll();
    
    if (resources.length === 0) {
        console.log("No assessment responses found in the entire container.");
    } else {
        console.log(`Found ${resources.length} total responses.`);
        resources.forEach(r => console.log(`User: ${r.userId}, ID: ${r.id}`));
    }
}

checkAnyAssessment().catch(console.error);
