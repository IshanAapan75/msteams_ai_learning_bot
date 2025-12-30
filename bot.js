const { TeamsActivityHandler, CardFactory } = require("botbuilder");
const { containers } = require("./lib/cosmos");
const { TeamsInfo } = require("botbuilder");

const appUrl = process.env.APP_URL || "http://localhost:3000";

class TeamsBot extends TeamsActivityHandler {
  constructor(conversationState) {
    super();

    this.conversationState = conversationState;
    this.quizState = this.conversationState.createProperty("quizState");

    this.onMessage(async (context, next) => {
      const text = context.activity.text ? context.activity.text.trim().toLowerCase() : "";
      const userId = context.activity.from.id;
      const userName = context.activity.from.name;

      await this.ensureUserExists(context, userId, userName);

      const state = await this.quizState.get(context, {
        inQuiz: false,
        quiz: null,
        questionIndex: 0,
        score: 0,
      });

      if (text === "start quiz") {
        state.inQuiz = true;
        const res = await fetch(`${appUrl}/api/quiz/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });

        if (!res.ok) {
          await context.sendActivity("It looks like there are no quizzes available for you at the moment.");
          state.inQuiz = false;
          return;
        }

        const { quiz } = await res.json();
        state.quiz = quiz;
        state.questionIndex = 0;
        state.score = 0;

        await context.sendActivity(`Starting quiz: ${quiz.title}`);
        if (!quiz.questions || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
          await context.sendActivity("This quiz doesn't contain any questions. Try another quiz later.");
          state.inQuiz = false;
        } else {
          try {
            await this.sendQuestion(context, state);
          } catch (err) {
            console.error('Error sending question:', err);
            await context.sendActivity('Sorry, I could not start the quiz due to an internal error.');
            state.inQuiz = false;
          }
        }
      } else if (text === "/profile") {
        const res = await fetch(
          `${appUrl}/api/user/profile?userId=${userId}`
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
        const res = await fetch(`${appUrl}/api/leaderboard`);
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

        const res = await fetch(`${appUrl}/api/quiz/answer`, {
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
          await this.ensureUserExists(context, member.id, member.name);
          const welcomeText = `👋 **Welcome to AI Champions Bot, ${member.name}!**\n\nType **start quiz** to see what I can do!\n\n`;
          await context.sendActivity(welcomeText);
        }
      }
      await next();
    });
  }

  async ensureUserExists(context, userId, userName) {
    try {
      const { resource: user } = await containers.users.item(userId, userId).read();
      if (!user) {
        const member = (await TeamsInfo.getMember(context, userId)) || {};
        let designation = "Engineer"; // Default designation
        let teamId = "Engineering"; // Default teamId

        if (member && member.userPrincipalName) {
          designation = member.userPrincipalName.includes("manager") ? "Manager" : "Engineer";
          teamId = designation === "Manager" ? "Management" : "Engineering";
        }

        await containers.users.items.create({
          id: userId,
          name: userName,
          designation: designation,
          teamId: teamId,
          xp: 0,
          level: 1,
          badges: [],
        });
      }
    } catch (error) {
      if (error.code === 404) {
        const member = (await TeamsInfo.getMember(context, userId)) || {};
        let designation = "Engineer"; // Default designation
        let teamId = "Engineering"; // Default teamId
        
        if (member && member.userPrincipalName) {
          designation = member.userPrincipalName.includes("manager") ? "Manager" : "Engineer";
          teamId = designation === "Manager" ? "Management" : "Engineering";
        }
        
        await containers.users.items.create({
          id: userId,
          name: userName,
          designation: designation,
          teamId: teamId,
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
    if (!state.quiz || !state.quiz.questions || !state.quiz.questions[state.questionIndex] || !state.quiz.questions[state.questionIndex].text) {
      console.error('Error: Quiz or question data is missing or invalid in sendQuestion.');
      await context.sendActivity('Error: Could not retrieve question details. Please contact support.');
      state.inQuiz = false; // Reset quiz state
      return;
    }
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
