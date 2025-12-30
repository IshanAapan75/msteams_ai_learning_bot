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
        allQuizzes: [],
        currentQuizIndex: 0,
        currentQuiz: null,
        questionIndex: 0,
        totalScore: 0,
        currentQuizScore: 0,
        currentResponses: [],
        aiLearningId: null,
        aiLearningStatus: "not started",
      });

      if (text === "start quiz") {
        const res = await fetch(`${appUrl}/api/quiz/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, fetchAll: true }),
        });

        if (!res.ok) {
          try {
            const errorPayload = await res.json();
            if (res.status === 403 && errorPayload?.aiLearningStatus !== "completed") {
              await context.sendActivity(
                "Please complete the AI learning modules before attempting the quiz."
              );
            } else if (res.status === 404) {
              await context.sendActivity("It looks like there are no quizzes available for you at the moment.");
            } else {
              await context.sendActivity(
                errorPayload?.error || "We couldn't start a quiz session right now."
              );
            }
          } catch (err) {
            console.error("[Bot] Failed to parse quiz assign error", err);
            await context.sendActivity("We couldn't start a quiz session right now.");
          }
          return;
        }

        const { quizzes } = await res.json();
        
        if (!quizzes || quizzes.length === 0) {
          await context.sendActivity("No quizzes found.");
          return;
        }

        state.inQuiz = true;
        state.allQuizzes = quizzes;
        state.currentQuizIndex = 0;
        state.currentQuiz = quizzes[0];
        state.questionIndex = 0;
        state.totalScore = 0;
        state.currentQuizScore = 0;
        state.currentResponses = [];
        state.aiLearningStatus = "completed";

        await context.sendActivity(
          `🎯 Starting Quiz Session!\n\nTotal Quizzes: ${quizzes.length}\n\n**Quiz 1/${quizzes.length}: ${state.currentQuiz.title}**`
        );

        if (!state.currentQuiz.questions || state.currentQuiz.questions.length === 0) {
          await context.sendActivity("This quiz doesn't contain any questions. Moving to next quiz...");
          await this.moveToNextQuiz(context, state);
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
      } else if (text === "/learning") {
        const res = await fetch(`${appUrl}/api/learning`);
        const learningModules = await res.json();
        const card = CardFactory.adaptiveCard({
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          version: "1.3",
          type: "AdaptiveCard",
          body: [
            {
              type: "TextBlock",
              text: "Available Learning Modules",
              weight: "bolder",
              size: "medium",
            },
            ...learningModules.map((module) => ({
              type: "FactSet",
              facts: [
                { title: "Topic", value: module.topic },
                { title: "Description", value: module.description },
                { title: "Level", value: module.level },
              ],
            })),
          ],
        });
        await context.sendActivity({ attachments: [card] });
      } else if (state.inQuiz) {
        const answer = context.activity.value ? context.activity.value.answer : text;
        const question = state.currentQuiz.questions[state.questionIndex];

        if (!state.currentResponses) {
          state.currentResponses = [];
        }

        state.currentResponses.push({
          questionId: question.id,
          answer,
          answeredAt: new Date().toISOString(),
        });

        state.questionIndex++;
        
        if (state.questionIndex < state.currentQuiz.questions.length) {
          await this.sendQuestion(context, state);
        } else {
          await this.submitQuizAttempt(context, state, userId);
          await this.moveToNextQuiz(context, state);
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

  async submitQuizAttempt(context, state, userId) {
    if (!state.currentQuiz || !Array.isArray(state.currentResponses) || state.currentResponses.length === 0) {
      await context.sendActivity("No responses recorded for this quiz. Skipping submission.");
      state.currentResponses = [];
      return;
    }

    try {
      const res = await fetch(`${appUrl}/api/quiz/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          quizId: state.currentQuiz.id,
          answers: state.currentResponses,
          aiLearningId: state.aiLearningId,
          aiLearningStatus: state.aiLearningStatus,
        }),
      });

      if (!res.ok) {
        console.error("[Bot] Failed to submit quiz attempt", res.statusText);
        await context.sendActivity("We couldn't record your quiz attempt. Please try again later.");
      } else {
        const result = await res.json();
        await context.sendActivity(
          `📊 Quiz "${state.currentQuiz.title}" submitted!\n` +
          `Score: ${result.score.correct}/${result.score.total}\n` +
          `Result: ${result.result}\n`
        );
      }
    } catch (error) {
      console.error("[Bot] Error submitting quiz attempt", error);
      await context.sendActivity("An error occurred while recording your quiz attempt.");
    }

    state.currentResponses = [];
    state.currentQuizScore = 0;
  }

  async moveToNextQuiz(context, state) {
    state.currentQuizIndex++;
    
    if (state.currentQuizIndex < state.allQuizzes.length) {
      state.currentQuiz = state.allQuizzes[state.currentQuizIndex];
      state.questionIndex = 0;
      state.currentQuizScore = 0;
      state.currentResponses = [];

      await context.sendActivity(
        `\n🎯 **Quiz ${state.currentQuizIndex + 1}/${state.allQuizzes.length}: ${state.currentQuiz.title}**\n`
      );

      if (!state.currentQuiz.questions || state.currentQuiz.questions.length === 0) {
        await context.sendActivity("This quiz doesn't contain any questions. Moving to next quiz...");
        await this.moveToNextQuiz(context, state);
      } else {
        try {
          await this.sendQuestion(context, state);
        } catch (err) {
          console.error('Error sending question:', err);
          await context.sendActivity('Sorry, could not load this quiz. Moving to next...');
          await this.moveToNextQuiz(context, state);
        }
      }
    } else {
      let totalQuestions = 0;
      state.allQuizzes.forEach(quiz => {
        if (quiz.questions) totalQuestions += quiz.questions.length;
      });

      await context.sendActivity(
        `🎉 **All Quizzes Completed!**\n\n` +
        `Total Quizzes: ${state.allQuizzes.length}\n` +
        `Total Questions: ${totalQuestions}\n` +
        `Thanks for completing the session! 🎊`
      );
      
      state.inQuiz = false;
      state.allQuizzes = [];
      state.currentQuiz = null;
      state.currentResponses = [];
      state.currentQuizIndex = 0;
      state.questionIndex = 0;
    }
  }

  async ensureUserExists(context, userId, userName) {
    try {
      const { resource: user } = await containers.users.item(userId, userId).read();
      if (!user) {
        const member = (await TeamsInfo.getMember(context, userId)) || {};
        let designation = "Engineer";
        let teamId = "Engineering";

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
        let designation = "Engineer";
        let teamId = "Engineering";
        
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
    if (!state.currentQuiz || !state.currentQuiz.questions || !state.currentQuiz.questions[state.questionIndex]) {
      console.error('Error: Quiz or question data is missing.');
      await context.sendActivity('Error: Could not retrieve question details.');
      state.inQuiz = false;
      return;
    }
    
    const question = state.currentQuiz.questions[state.questionIndex];
    
    if (!question.text || !question.options) {
      console.error('Error: Question text or options missing.');
      await context.sendActivity('Error: Invalid question format.');
      return;
    }

    const card = CardFactory.adaptiveCard({
      $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
      version: "1.3",
      type: "AdaptiveCard",
      body: [
        {
          type: "TextBlock",
          text: `Question ${state.questionIndex + 1}/${state.currentQuiz.questions.length}`,
          weight: "bolder",
          size: "small",
          color: "accent"
        },
        {
          type: "TextBlock",
          text: question.text,
          wrap: true,
          size: "medium"
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
