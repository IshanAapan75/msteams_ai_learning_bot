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

// REAL IDs found in DB
const MANAGER_ANISHA_ID = "29:1VJWyPGd7kC35tSypp-Q4rt3-PEmcL75drhwwBhZyjTutBIXnGltXj8Nagh8iwEpYNeAE6kDZsodqjoLKJA4Hxg";
const MANAGER_PRIYANKA_ID = "29:1sYO2GoWXHIWFt2LuafAJnwuqdLZWCfPAkt0Y8YVQO26AH8_z9OROh-I73DytH0FklqvXMTVpYw-YpBoUHOnzlA";

const directReportsMap = {
  [MANAGER_ANISHA_ID]: ["user-alice", "user-bob", "user-charlie", "user-david"],
  [MANAGER_PRIYANKA_ID]: ["user-eve", "user-frank", "user-grace", "user-henry"],
};

const DUMMY_MANAGERS_TO_REMOVE = ["user-anisha", "user-priyanka"];

async function main() {
    console.log("Starting manager reassignment...");
    const db = client.database(process.env.COSMOS_DATABASE || "ChatBotDB");
    const userContainer = db.container("users");

    // 1. Update Managers with Direct Reports
    for (const [managerId, reportIds] of Object.entries(directReportsMap)) {
        try {
            const { resource: manager } = await userContainer.item(managerId, managerId).read();
            if (manager) {
                // Merge with existing direct reports if any, avoiding duplicates
                const existingReports = manager.directReports || [];
                const newReports = [...new Set([...existingReports, ...reportIds])];
                
                manager.directReports = newReports;
                // Ensure they have a role for the dashboard view
                if (!manager.role) manager.role = "Manager";
                // Ensure they have managed teams set
                if (!manager.managedTeams) manager.managedTeams = ["team-alpha", "team-beta", "team-gamma"];

                await userContainer.items.upsert(manager);
                console.log(`Updated manager: ${manager.name} with ${newReports.length} reports.`);
            } else {
                console.error(`Manager ID ${managerId} not found!`);
            }
        } catch (err) {
            console.error(`Error updating manager ${managerId}:`, err.message);
        }
    }

    // 2. Update Direct Reports to point to new Managers
    for (const [managerId, reportIds] of Object.entries(directReportsMap)) {
        for (const reportId of reportIds) {
            try {
                const { resource: user } = await userContainer.item(reportId, reportId).read();
                if (user) {
                    user.manager = managerId;
                    await userContainer.items.upsert(user);
                    console.log(`Assigned ${user.name} to manager ${managerId}`);
                } else {
                    console.warn(`User ${reportId} not found.`);
                }
            } catch (error) {
                console.error(`Failed to update user ${reportId}:`, error.message);
            }
        }
    }

    // 3. Clean up dummy managers
    console.log("Cleaning up dummy manager records...");
    for (const id of DUMMY_MANAGERS_TO_REMOVE) {
        try {
            await userContainer.item(id, id).delete();
            console.log(`Deleted dummy user: ${id}`);
        } catch (err) {
            if (err.code === 404) {
                console.log(`Dummy user ${id} already gone.`);
            } else {
                console.error(`Error deleting ${id}:`, err.message);
            }
        }
    }

    console.log("Reassignment complete!");
}

main().catch(console.error);