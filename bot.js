const { ActivityHandler, MessageFactory } = require('botbuilder');

class TeamsBot extends ActivityHandler {
    constructor() {
        super();

        // Conversation state storage
        this.conversationReferences = {};
        this.conversationStates = {};

        // Handle incoming messages
        this.onMessage(async (context, next) => {
            const text = context.activity.text.toLowerCase().trim();
            const conversationId = context.activity.conversation.id;

            // Initialize state for this conversation
            if (!this.conversationStates[conversationId]) {
                this.conversationStates[conversationId] = { count: 0 };
            }

            const state = this.conversationStates[conversationId];

            // Command handlers
            if (text === '/reset') {
                this.conversationStates[conversationId] = { count: 0 };
                await context.sendActivity('✅ Conversation state reset!');
            }
            else if (text === '/count') {
                await context.sendActivity(`📊 Current count: ${state.count}`);
            }
            else if (text === '/help') {
                const helpText = `
🤖 **Available Commands:**
- **/reset** - Reset conversation
- **/count** - Show message count
- **/help** - Show this help
- **/state** - Show current state
- **hello** - Get a greeting
                `;
                await context.sendActivity(helpText);
            }
            else if (text === '/state') {
                await context.sendActivity(`State: ${JSON.stringify(state, null, 2)}`);
            }
            else if (text.includes('hello') || text.includes('hi')) {
                await context.sendActivity('👋 Hello! How can I help you today?');
                state.count++;
            }
            else {
                // Echo back the message
                state.count++;
                await context.sendActivity(`[${state.count}] You said: ${context.activity.text}`);
            }

            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });

        // Handle members added (bot added to team/chat)
        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            const welcomeText = '👋 Hello! I\'m your AI Champions Bot. Type **/help** to see what I can do!';

            for (let member of membersAdded) {
                if (member.id !== context.activity.recipient.id) {
                    await context.sendActivity(MessageFactory.text(welcomeText));
                }
            }

            await next();
        });
    }

    async run(context) {
        await super.run(context);
    }
}

module.exports.TeamsBot = TeamsBot;
