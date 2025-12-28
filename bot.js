const { ActivityHandler, CardFactory } = require("botbuilder");
const { containers } = require("./lib/cosmos");

class TeamsBot extends ActivityHandler {
  constructor(conversationState) {
    super();

    this.conversationState = conversationState;
    this.quizState = this.conversationState.createProperty("quizState");

    this.onMessage(async (context, next) => {
      const text = context.activity.text ? context.activity.text.trim().toLowerCase() : "";
      const userId = context.activity.from.id;
      const userName = context.activity.from.name;

      await this.ensureUserExists(userId, userName);

      const state = await this.quizState.get(context, {
        inQuiz: false,
        quiz: null,
        questionIndex: 0,
        score: 0,
      });

      if (text === "start quiz") {
        state.inQuiz = true;
        const res = await fetch("http://localhost:3000/api/quiz/assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        const { quiz } = await res.json();
        state.quiz = quiz;
        state.questionIndex = 0;
        state.score = 0;

        await context.sendActivity(`Starting quiz: ${quiz.title}`);
        await this.sendQuestion(context, state);
      } else if (text === "/profile") {
        const res = await fetch(
          `http://localhost:3000/api/user/profile?userId=${userId}`
        );
        const user = await res.json();
        const card = CardFactory.adaptiveCard({
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          version: "1.3",
          type: "AdaptiveCard",
          body: [
            {
              type: "TextBlock",
              text: `User Profile: ${user.name}`,
              weight: "bolder",
              size: "medium",
            },
            {
              type: "FactSet",
              facts: [
                { title: "Level", value: user.level },
                { title: "XP", value: user.xp },
                { title: "Badges", value: (user.badges || []).join(", ") || "No badges yet" },
              ],
            },
          ],
        });
        await context.sendActivity({ attachments: [card] });
      } else if (text === "/leaderboard") {
        const res = await fetch("http://localhost:3000/api/leaderboard");
        const { teams, users } = await res.json();
        const card = CardFactory.adaptiveCard({
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          version: "1.3",
          type: "AdaptiveCard",
          body: [
            {
              type: "TextBlock",
              text: "Leaderboard",
              weight: "bolder",
              size: "medium",
            },
            {
              type: "TextBlock",
              text: "Teams",
              weight: "bolder",
            },
            {
              type: "FactSet",
              facts: teams.map((t) => ({
                title: t.name,
                value: t.score,
              })),
            },
            {
              type: "TextBlock",
              text: "Users",
              weight: "bolder",
            },
            {
              type: "FactSet",
              facts: users.map((u) => ({
                title: u.name,
                value: u.xp,
              })),
            },
          ],
        });
        await context.sendActivity({ attachments: [card] });
      } else if (state.inQuiz) {
        const answer = context.activity.value ? context.activity.value.answer : text;
        const question = state.quiz.questions[state.questionIndex];

        const res = await fetch("http://localhost:3000/api/quiz/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, questionId: question.id, answer }),
        });
        const result = await res.json();

        if (result.correct) {
          state.score++;
          await context.sendActivity("Correct!");
        } else {
          await context.sendActivity("Incorrect.");
        }

        state.questionIndex++;
        if (state.questionIndex < state.quiz.questions.length) {
          await this.sendQuestion(context, state);
        } else {
          await context.sendActivity(
            `Quiz finished! You scored ${state.score}/${state.quiz.questions.length}`
          );
          state.inQuiz = false;
        }
      } else {
        await context.sendActivity("Say 'start quiz' to begin, or /profile or /leaderboard to see stats.");
      }

      await this.conversationState.saveChanges(context);
      await next();
    });

    this.onMembersAdded(async (context, next) => {
      for (const member of context.activity.membersAdded) {
        if (member.id !== context.activity.recipient.id) {
          await this.ensureUserExists(member.id, member.name);
          const welcomeText = `👋 **Welcome to AI Champions Bot, ${member.name}!**\n\nType **start quiz** to see what I can do!\n\n`;
          await context.sendActivity(welcomeText);
        }
      }
      await next();
    });
  }

  async ensureUserExists(userId, userName) {
    try {
      const { resource: user } = await containers.users.item(userId, userId).read();
      if (!user) {
        await containers.users.items.create({
          id: userId,
          name: userName,
          designation: "Default Designation", // Placeholder
          teamId: "Default Team", // Placeholder
          xp: 0,
          level: 1,
          badges: [],
        });
      }
    } catch (error) {
      if (error.code === 404) {
        await containers.users.items.create({
          id: userId,
          name: userName,
          designation: "Default Designation", // Placeholder
          teamId: "Default Team", // Placeholder
          xp: 0,
          level: 1,
          badges: [],
        });
      } else {
        console.error("Error ensuring user exists:", error);
      }
    }
  }

  async sendQuestion(context, state) {
    const question = state.quiz.questions[state.questionIndex];
    const card = CardFactory.adaptiveCard({
      $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
      version: "1.3",
      type: "AdaptiveCard",
      body: [
        {
          type: "TextBlock",
          text: question.text,
          wrap: true,
        },
      ],
      actions: question.options.map((option) => ({
        type: "Action.Submit",
        title: option,
        data: {
          answer: option,
        },
      })),
    });
    await context.sendActivity({ attachments: [card] });
  }
}

module.exports.TeamsBot = TeamsBot;
