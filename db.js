const { containers } = require("./lib/cosmos");

// Save question to database
async function saveQuestion(conversationId, userId, userName, question, answer) {
    try {
        const document = {
            id: `${conversationId}-${Date.now()}`, // Unique ID
            conversationId: conversationId,
            userId: userId,
            userName: userName,
            question: question,
            answer: answer,
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString()
        };

        const { resource: result } = await containers.conversations.items.create(document);
        console.log('✅ Question saved to database:', result.id);
        return result;
    } catch (error) {
        console.error('❌ Error saving to database:', error.message);
        return null;
    }
}

// Get all questions from a conversation
async function getQuestions(conversationId) {
    try {
        const querySpec = {
            query: "SELECT * FROM c WHERE c.conversationId = @conversationId ORDER BY c.timestamp DESC",
            parameters: [
                {
                    name: "@conversationId",
                    value: conversationId
                }
            ]
        };

        const { resources: results } = await containers.conversations.items
            .query(querySpec)
            .fetchAll();

        console.log(`✅ Retrieved ${results.length} questions from database`);
        return results;
    } catch (error) {
        console.error('❌ Error retrieving from database:', error.message);
        return [];
    }
}

// Get total question count
async function getTotalQuestions() {
    try {
        const querySpec = {
            query: "SELECT VALUE COUNT(1) FROM c"
        };

        const { resources: results } = await containers.conversations.items
            .query(querySpec)
            .fetchAll();

        return results[0] || 0;
    } catch (error) {
        console.error('❌ Error counting questions:', error.message);
        return 0;
    }
}

module.exports = {
    saveQuestion,
    getQuestions,
    getTotalQuestions
};
