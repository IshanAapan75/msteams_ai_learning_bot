const restify = require('restify');
const next = require('next');
const { BotFrameworkAdapter, ConversationState, MemoryStorage } = require('botbuilder');
const { TeamsBot } = require('./bot');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = restify.createServer();
    server.use(restify.plugins.bodyParser());

    const port = process.env.PORT || 3978;
    server.listen(port, () => {
        console.log(`\n${server.name} listening on ${server.url}`);
        console.log('\nBot is ready!');
    });

    const adapter = new BotFrameworkAdapter({
        appId: process.env.MicrosoftAppId,
        appPassword: process.env.MicrosoftAppPassword,
        appType: process.env.MicrosoftAppType || 'SingleTenant',
        channelAuthTenant: process.env.MicrosoftAppTenantId
    });

    adapter.onTurnError = async (context, error) => {
        console.error(`\n [onTurnError] unhandled error: ${error}`);
        await context.sendActivity('The bot encountered an error.');
        await conversationState.delete(context);
    };

    const memoryStorage = new MemoryStorage();
    const conversationState = new ConversationState(memoryStorage);
    const bot = new TeamsBot(conversationState);

    server.post('/api/messages', (req, res) => {
        adapter.process(req, res, async (context) => {
            await bot.run(context);
        });
    });

    server.get('*', (req, res) => {
        return handle(req, res);
    });
    
    server.post('*', (req, res) => {
        return handle(req, res);
    });
});
