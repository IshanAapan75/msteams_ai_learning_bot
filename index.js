const restify = require('restify');
const { BotFrameworkAdapter } = require('botbuilder');
const { TeamsBot } = require('./bot');

// Create HTTP server
const server = restify.createServer();
server.use(restify.plugins.bodyParser());

// Server listening on port
const port = process.env.PORT || 3978;
server.listen(port, () => {
    console.log(`\n${server.name} listening on ${server.url}`);
    console.log('\nBot is ready!');
});

// Create adapter
const adapter = new BotFrameworkAdapter({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    appType: process.env.MicrosoftAppType || 'SingleTenant',
    channelAuthTenant: process.env.MicrosoftAppTenantId
});

// Error handler
adapter.onTurnError = async (context, error) => {
    console.error(`\n [onTurnError] unhandled error: ${error}`);
    await context.sendActivity('The bot encountered an error.');
};

// Create bot
const bot = new TeamsBot();

// Listen for incoming requests - CRITICAL!
server.post('/api/messages', async (req, res) => {
    await adapter.process(req, res, async (context) => {
        await bot.run(context);
    });
});

// Health check endpoint
server.get('/', (req, res, next) => {
    res.send({ status: 'Bot is running!' });
    return next();
});
