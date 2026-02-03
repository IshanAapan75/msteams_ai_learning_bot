const express = require('express');
const next = require('next');
const { BotFrameworkAdapter, ConversationState, MemoryStorage } = require('botbuilder');
const { TeamsBot } = require('./bot');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = express();
    
    const port = process.env.PORT || 3978;

    const adapter = new BotFrameworkAdapter({
        appId: process.env.MicrosoftAppId,
        appPassword: process.env.MicrosoftAppPassword,
        appType: process.env.MicrosoftAppType || 'SingleTenant',
        channelAuthTenant: process.env.MicrosoftAppTenantId
    });

    const memoryStorage = new MemoryStorage();
    const conversationState = new ConversationState(memoryStorage);
    const bot = new TeamsBot(conversationState);

    adapter.onTurnError = async (context, error) => {
        console.error(`\n [onTurnError] unhandled error: ${error}`);
        console.error('Stack trace:', error.stack);
        await context.sendActivity('The bot encountered an error.');
        await conversationState.delete(context);
    };

    server.post('/api/messages', (req, res) => {
        adapter.process(req, res, async (context) => {
            await bot.run(context);
        });
    });

    server.all('*', (req, res) => {
        return handle(req, res);
    });

    server.listen(port, () => {
        console.log(`\nServer listening on port ${port}`);
        console.log('\nBot is ready!');

        // Run proactive notifications every 15 minutes
        const { fork } = require('child_process');
        const path = require('path');
        
        const runNotifier = () => {
            console.log('[Scheduler] Triggering proactive notifications...');
            const child = fork(path.join(__dirname, 'scripts', 'notify_proactive.js'));
            child.on('exit', (code) => {
                console.log(`[Scheduler] Notifier process exited with code ${code}`);
            });
        };

        // Initial run after 1 minute
        setTimeout(runNotifier, 60000);
        // Periodic run
        setInterval(runNotifier, 15 * 60000);
    });
});