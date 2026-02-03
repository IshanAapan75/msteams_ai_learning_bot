const { BotFrameworkAdapter } = require("botbuilder");
const { containers } = require("../lib/cosmos");
const { fetchResponseProgress, saveResponseProgress } = require("../lib/learningProgress");
require("dotenv").config({ path: "./env/.env.dev" });

const adapter = new BotFrameworkAdapter({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    appType: process.env.MicrosoftAppType || 'MultiTenant',
    channelAuthTenant: process.env.MicrosoftAppTenantId
});

const MINS_TO_MS = 60 * 1000;

async function runNotifications() {
    console.log(`[Proactive] Notification run started at ${new Date().toISOString()}`);

    const { resources: allUsers } = await containers.users.items.readAll().fetchAll();
    
    for (const user of allUsers) {
        if (!user.conversationReference) continue;

        try {
            await checkUnlockNotifications(user);
            await checkStreakNotification(user);
            await checkUsageReminder(user);
        } catch (err) {
            console.error(`[Proactive] Error processing user ${user.id}:`, err);
        }
    }

    console.log(`[Proactive] Notification run finished.`);
}

/**
 * 1. Unlock Notifications (1m Warning and Unlocked Alert)
 */
async function checkUnlockNotifications(user) {
    const progress = await fetchResponseProgress(user.id);
    const activeLearning = progress.learnings?.find(l => l.status === "available" && l.availableAt);

    if (!activeLearning) return;

    const availableTime = new Date(activeLearning.availableAt).getTime();
    const now = Date.now();
    const timeUntilUnlock = availableTime - now;

    // A. 1 Minute Warning
    if (timeUntilUnlock > 0 && timeUntilUnlock <= (1.1 * MINS_TO_MS)) {
        if (!activeLearning.notified17h) {
            await sendProactiveMessage(user, `⏳ Your next learning module "**${activeLearning.module?.title || activeLearning.learningId}**" is about to unlock in about 1 minute! Get ready!`);
            activeLearning.notified17h = true;
            await saveResponseProgress(progress);
        }
    }

    // B. Unlocked Alert
    if (timeUntilUnlock <= 0) {
        if (!activeLearning.notifiedUnlocked) {
            await sendProactiveMessage(user, `🎉 Good news! Your next learning module "**${activeLearning.module?.title || activeLearning.learningId}**" is now UNLOCKED and ready for you.`);
            activeLearning.notifiedUnlocked = true;
            await saveResponseProgress(progress);
        }
    }
}

/**
 * 2. Streak Protection (Modified for fast test: 5 mins)
 */
async function checkStreakNotification(user) {
    if (!user.lastActivityAt) return;

    const lastActivity = new Date(user.lastActivityAt).getTime();
    const idleTime = Date.now() - lastActivity;

    if (idleTime >= (5 * MINS_TO_MS) && idleTime < (10 * MINS_TO_MS)) {
        if (!user.notifiedStreak20h) {
            await sendProactiveMessage(user, `🔥 Don't let your streak cool down! You haven't checked in for 5 minutes. Jump back in to keep your momentum going!`);
            user.notifiedStreak20h = true;
            await containers.users.item(user.id, user.id).replace(user);
        }
    } else if (idleTime < (1 * MINS_TO_MS)) {
        if (user.notifiedStreak20h) {
            user.notifiedStreak20h = false;
            await containers.users.item(user.id, user.id).replace(user);
        }
    }
}

/**
 * 3. Usage Reminder (3m after ANY activity)
 */
async function checkUsageReminder(user) {
    if (!user.lastActivityAt) return;

    const lastActivity = new Date(user.lastActivityAt).getTime();
    const lastUsage = user.lastUsageLogAt ? new Date(user.lastUsageLogAt).getTime() : 0;
    const now = Date.now();
    
    const idleTimeSinceActivity = now - lastActivity;
    const timeSinceLastUsage = now - lastUsage;

    if (idleTimeSinceActivity >= (3 * MINS_TO_MS) && idleTimeSinceActivity < (6 * MINS_TO_MS)) {
        if (timeSinceLastUsage >= (3 * MINS_TO_MS)) {
            if (!user.notifiedUsage4h) {
                await sendProactiveMessage(user, `💡 It's been 3 minutes since your last activity. Don't forget to log any "AI Wins" you've had!`);
                user.notifiedUsage4h = true;
                await containers.users.item(user.id, user.id).replace(user);
            }
        }
    } else if (idleTimeSinceActivity < (1 * MINS_TO_MS)) {
        if (user.notifiedUsage4h) {
            user.notifiedUsage4h = false;
            await containers.users.item(user.id, user.id).replace(user);
        }
    }
}

async function sendProactiveMessage(user, text) {
    console.log(`[Proactive] Sending message to ${user.id}: ${text}`);
    try {
        await adapter.continueConversation(user.conversationReference, async (context) => {
            await context.sendActivity(text);
        });
    } catch (err) {
        console.error(`[Proactive] Failed to send message to ${user.id}:`, err);
    }
}

// Execute
runNotifications();
