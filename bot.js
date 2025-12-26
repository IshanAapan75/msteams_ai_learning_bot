const { ActivityHandler } = require('botbuilder');
const { saveQuestion, getQuestions, getTotalQuestions } = require('./db');

class TeamsBot extends ActivityHandler {
    constructor() {
        super();

        this.onMessage(async (context, next) => {
            const text = context.activity.text.trim();
            const conversationId = context.activity.conversation.id;
            const userId = context.activity.from.id;
            const userName = context.activity.from.name;

            let responseText = '';

            // Command: /history - Show saved questions
            if (text.toLowerCase() === '/history') {
                const questions = await getQuestions(conversationId);
                
                if (questions.length === 0) {
                    responseText = '📋 No questions saved yet. Ask me something!';
                } else {
                    responseText = `📋 **Your Question History:**\n\n`;
                    questions.slice(0, 5).forEach((q, index) => {
                        responseText += `${index + 1}. **Q:** ${q.question}\n   **A:** ${q.answer}\n   ⏰ ${q.time}\n\n`;
                    });
                }
            }
            // Command: /stats - Show total questions
            else if (text.toLowerCase() === '/stats') {
                const total = await getTotalQuestions();
                responseText = `📊 **Statistics:**\n- Total questions saved: ${total}\n- Your user ID: ${userId}`;
            }
            // Command: /help
            else if (text.toLowerCase() === '/help') {
                responseText = `🤖 **Available Commands:**\n\n` +
                    `• **/help** - Show this help\n` +
                    `• **/history** - Show your question history\n` +
                    `• **/stats** - Show database statistics\n` +
                    `• **Ask any question** - I'll save it to database!\n\n` +
                    `Try asking me: "What is AI?"`;
            }
            // Regular question - Save to database
            else {
                // Generate answer
                if (text.toLowerCase().includes('hello') || text.toLowerCase().includes('hi')) {
                    responseText = `👋 Hello ${userName}! How can I help you today?`;
                } else if (text.toLowerCase().includes('what is ai')) {
                    responseText = '🤖 AI (Artificial Intelligence) is the simulation of human intelligence by machines, especially computer systems.';
                } else if (text.toLowerCase().includes('what is ml')) {
                    responseText = '📊 Machine Learning (ML) is a subset of AI that enables systems to learn and improve from experience without being explicitly programmed.';
                } else {
                    responseText = `Thank you for your question: "${text}"\n\nI'm learning and will improve my responses! This has been saved to the database. 💾`;
                }

                // Save question and answer to database
                const saved = await saveQuestion(conversationId, userId, userName, text, responseText);
                
                if (saved) {
                    responseText += '\n\n✅ *Question saved to database!*';
                }
            }

            // Send response
            await context.sendActivity(responseText);

            await next();
        });

        this.onMembersAdded(async (context, next) => {
            const welcomeText = '👋 **Welcome to AI Champions Bot!**\n\n' +
                'Type **/help** to see what I can do!\n\n' +
                'All your questions will be saved to the database. 💾';
            
            for (let member of context.activity.membersAdded) {
                if (member.id !== context.activity.recipient.id) {
                    await context.sendActivity(welcomeText);
                }
            }
            await next();
        });
    }
}

module.exports.TeamsBot = TeamsBot;
