// const express = require('express');
// const next = require('next');
// const { BotFrameworkAdapter, ConversationState, MemoryStorage } = require('botbuilder');
// const { TeamsBot } = require('./bot');

// const dev = process.env.NODE_ENV !== 'production';
// const app = next({ dev });
// const handle = app.getRequestHandler();

// app.prepare().then(() => {
//     const server = express();
//     // Removed global body-parsing middleware:
//     // server.use(express.json());
//     // server.use(express.urlencoded({ extended: true }));

//     const port = process.env.PORT || 3978;
//     server.listen(port, () => {
//         console.log(`\nServer listening on port ${port}`);
//         console.log('\nBot is ready!');
//     });

//     const adapter = new BotFrameworkAdapter({
//         appId: process.env.MicrosoftAppId,
//         appPassword: process.env.MicrosoftAppPassword,
//         appType: process.env.MicrosoftAppType || 'SingleTenant',
//         channelAuthTenant: process.env.MicrosoftAppTenantId
//     });

//     adapter.onTurnError = async (context, error) => {
//         console.error(`\n [onTurnError] unhandled error: ${error}`);
//         await context.sendActivity('The bot encountered an error.');
//         await conversationState.delete(context);
//     };

//     const memoryStorage = new MemoryStorage();
//     const conversationState = new ConversationState(memoryStorage);
//     const bot = new TeamsBot(conversationState);

//     server.post('/api/messages', (req, res) => {
//         adapter.process(req, res, async (context) => {
//             await bot.run(context);
//         });
//     });

//     server.get('*', (req, res) => {
//         return handle(req, res);
//     });
    
//     server.post('*', (req, res) => {
//         return handle(req, res);
//     });
// });




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

    // Bot messages endpoint - let adapter handle body parsing
    server.post('/api/messages', (req, res) => {
        adapter.process(req, res, async (context) => {
            await bot.run(context);
        });
    });

    // Add JSON parsing for other API routes
    server.use('/api', express.json());
    server.use('/api', express.urlencoded({ extended: true }));

    // Next.js handles all other routes
    server.all('*', (req, res) => {
        return handle(req, res);
    });

    server.listen(port, () => {
        console.log(`\nServer listening on port ${port}`);
        console.log('\nBot is ready!');
    });
});
