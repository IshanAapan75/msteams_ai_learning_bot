const { TeamsActivityHandler, CardFactory } = require("botbuilder");
const { TeamsInfo } = require("botbuilder");
const { upsertUserProfile } = require("./lib/users");
const { syncLearningAssignment } = require("./lib/learningPlan.js");

const appUrl = process.env.APP_URL || "http://localhost:3000";

const httpFetch = (...args) =>
  typeof fetch === "function"
    ? fetch(...args)
    : import("node-fetch").then(({ default: fetchImpl }) => fetchImpl(...args));

const LANGUAGE_CHOICES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Japanese",
  "Hindi",
  "Portuguese",
  "Chinese",
  "Korean",
  "Italian",
  "Arabic",
  "Other",
];

function buildLearningSummaryCard(assignment) {
  if (!assignment?.module) {
    return null;
  }

  const lines = [
    {
      type: "TextBlock",
      text: `📘 **${assignment.module.topic || assignment.module.title} (${assignment.module.level || "Any"})**`,
      wrap: true,
      weight: "bolder",
      size: "medium",
    },
  ];

  if (assignment.module.description) {
    lines.push({
      type: "TextBlock",
      text: assignment.module.description,
      wrap: true,
    });
  }

  if (assignment.module.details) {
    lines.push({
      type: "TextBlock",
      text: assignment.module.details,
      wrap: true,
      spacing: "small",
    });
  }

  const statusFacts = [];
  statusFacts.push({ title: "Status", value: assignment.status || "assigned" });
  if (assignment.availableAt) {
    statusFacts.push({ title: "Available", value: new Date(assignment.availableAt).toLocaleString() });
  }
  if (assignment.completedAt) {
    statusFacts.push({ title: "Completed", value: new Date(assignment.completedAt).toLocaleString() });
  }
  if (assignment.quizPassedAt) {
    statusFacts.push({ title: "Quiz", value: `Passed ${new Date(assignment.quizPassedAt).toLocaleString()}` });
  }

  const body = [
    ...lines,
    {
      type: "FactSet",
      facts: statusFacts,
    },
    {
      type: "TextBlock",
      text: assignment.canStart
        ? "Ready to open now. Type **/learning** to read the module."
        : "Module is locked for a short cooldown to build healthy habits. I’ll remind you when it’s ready!",
      wrap: true,
      spacing: "medium",
    },
  ];

  const actions = [];
  if (assignment.canStart) {
    actions.push({
      type: "Action.Submit",
      title: "Mark Learning Complete",
      data: {
        action: "complete_learning",
        learningId: assignment.learningId,
      },
    });
  }

  return CardFactory.adaptiveCard({
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    type: "AdaptiveCard",
    body,
    actions,
  });
}

function buildSurveyCard(learningId) {
  return CardFactory.adaptiveCard({
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    type: "AdaptiveCard",
    body: [
      {
        type: "TextBlock",
        text: "👏 Awesome! Tell us about your AI win",
        weight: "bolder",
        size: "medium",
      },
      {
        type: "TextBlock",
        text: "What did you use AI for? *",
        weight: "bolder",
        spacing: "medium",
      },
      {
        type: "Input.ChoiceSet",
        id: "actionType",
        style: "expanded",
        isMultiSelect: false,
        choices: [
          "Email drafting",
          "Meeting summaries",
          "Data analysis",
          "Code review",
          "Content creation",
          "Research",
          "Presentation prep",
          "Other",
        ].map((label) => ({ title: label, value: label })),
      },
      {
        type: "TextBlock",
        text: "How much time did you save? *",
        weight: "bolder",
        spacing: "medium",
      },
      {
        type: "Input.ChoiceSet",
        id: "timeSaved",
        style: "expanded",
        choices: [
          "1-5 min",
          "6-15 min",
          "16-30 min",
          "31-60 min",
          "60+ min",
        ].map((label) => ({ title: label, value: label })),
      },
      {
        type: "TextBlock",
        text: "Confidence in output quality *",
        weight: "bolder",
        spacing: "medium",
      },
      {
        type: "Input.ChoiceSet",
        id: "confidence",
        style: "expanded",
        choices: [
          { title: "Low", value: "low" },
          { title: "Medium", value: "medium" },
          { title: "High", value: "high" },
        ],
      },
      {
        type: "TextBlock",
        text: "Brief description (optional)",
        spacing: "medium",
      },
      {
        type: "Input.Text",
        id: "notes",
        isMultiline: true,
        placeholder: "How did AI help you today?",
      },
    ],
    actions: [
      {
        type: "Action.Submit",
        title: "Submit",
        data: {
          action: "submit_survey",
          learningId,
        },
      },
    ],
  });
}

function buildLanguagePreferenceCard() {
  return CardFactory.adaptiveCard({
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    type: "AdaptiveCard",
    body: [
      {
        type: "TextBlock",
        text: "🌐 Choose your preferred language",
        weight: "bolder",
        size: "medium",
      },
      {
        type: "TextBlock",
        text: "We'll personalize your experience based on this selection.",
        isSubtle: true,
        wrap: true,
        spacing: "small",
      },
      {
        type: "Input.ChoiceSet",
        id: "language",
        style: "expanded",
        choices: LANGUAGE_CHOICES.map((label) => ({ title: label, value: label })),
      },
    ],
    actions: [
      {
        type: "Action.Submit",
        title: "Save preference",
        data: { action: "set_language" },
      },
    ],
  });
}

async function fetchAssignment(userId) {
  const res = await httpFetch(`${appUrl}/api/learning?userId=${encodeURIComponent(userId)}&sync=1`);
  if (!res.ok) {
    return null;
  }
  return res.json();
}

async function getUserProfile(userId) {
  const res = await httpFetch(`${appUrl}/api/user/profile?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) {
    return null;
  }
  return res.json();
}

async function updateUserLanguage(userId, language) {
  const res = await httpFetch(`${appUrl}/api/user/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, language }),
  });
  if (!res.ok) {
    throw new Error("Failed to update language");
  }
  return res.json();
}

class TeamsBot extends TeamsActivityHandler {
  constructor(conversationState) {
    super();
    this.conversationState = conversationState;
    this.quizState = this.conversationState.createProperty("quizState");

    this.onMessage(async (context, next) => {
      const text = context.activity.text?.trim().toLowerCase() || "";
      const userId = context.activity.from.id;
      const userName = context.activity.from.name;

      await this.ensureUserExists(context, userId, userName);

      const state = await this.quizState.get(context, {
        inQuiz: false,
        aiLearningId: null,
        aiLearningStatus: "assigned",
        aiLearningQuizzes: [],
        currentQuiz: null,
        questionIndex: 0,
        currentResponses: [],
        language: null,
        awaitingLanguage: false,
      });

      const profile = await getUserProfile(userId);
      if (profile) {
        state.language = state.language || profile.language || null;
        state.aiLearningId = state.aiLearningId || profile.lastCompletedLearningId || null;
      }

      if (context.activity.value?.action === "set_language") {
        const selectedLanguage = context.activity.value.language;
        if (!selectedLanguage) {
          await context.sendActivity("Please choose a language from the list.");
          return;
        }
        try {
          await updateUserLanguage(userId, selectedLanguage);
          state.language = selectedLanguage;
          state.awaitingLanguage = false;
          await context.sendActivity(`✅ Saved **${selectedLanguage}** as your language preference.`);
        } catch (error) {
          console.error("[Bot] Failed to update language", error);
          await context.sendActivity("I couldn't save that preference. Please try again.");
          return;
        }
      }

      if (!state.language) {
        if (!state.awaitingLanguage) {
          const card = buildLanguagePreferenceCard();
          await context.sendActivity({ attachments: [card] });
          state.awaitingLanguage = true;
        } else {
          await context.sendActivity("Please pick a language to continue.");
        }
        await this.conversationState.saveChanges(context);
        return;
      }

      state.awaitingLanguage = false;
      const assignment = await fetchAssignment(userId);
      state.aiLearningId = assignment?.assignment?.learningId || state.aiLearningId;
      state.aiLearningStatus = assignment?.assignment?.status || state.aiLearningStatus;
      state.aiLearningQuizzes = assignment?.assignment?.module?.quizzes || state.aiLearningQuizzes;

      if (text === "start quiz") {
        if (assignment?.assignment && assignment.assignment.status !== "completed") {
          await context.sendActivity(
            "Please finish the current learning module before starting the quiz. Type `/learning` to view it."
          );
          return;
        }

        const quizPayload = {
          userId,
          fetchAll: true,
          aiLearningId: state.aiLearningId,
          aiLearningQuizzes: state.aiLearningQuizzes,
        };

        const res = await httpFetch(`${appUrl}/api/quiz/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(quizPayload),
        });

        if (!res.ok) {
          const errorBody = await res.json().catch(() => ({}));
          await context.sendActivity(errorBody.error || "I couldn't find a quiz right now.");
          return;
        }

        const data = await res.json();
        if (!data.quizzes?.length) {
          await context.sendActivity("No quizzes are ready yet—please check back later.");
          return;
        }

        state.inQuiz = true;
        state.allQuizzes = data.quizzes;
        state.currentQuizIndex = 0;
        state.currentQuiz = data.quizzes[0];
        state.questionIndex = 0;
        state.currentResponses = [];
        state.aiLearningId = data.aiLearningId;
        state.aiLearningStatus = data.aiLearningStatus;

        await context.sendActivity(
          `🎯 Starting quiz for ${state.currentQuiz.title}. Answer each question to proceed.`
        );
        await this.sendQuestion(context, state);
        await this.conversationState.saveChanges(context);
        return;
      }

      if (text === "/learning") {
        if (!assignment?.assignment) {
          await context.sendActivity("I couldn't find any learning modules for you yet.");
          return;
        }

        const card = buildLearningSummaryCard(assignment.assignment);
        if (card) {
          await context.sendActivity({ attachments: [card] });
        }
        return;
      }

      if (context.activity.value?.action === "complete_learning") {
        const { learningId } = context.activity.value;
        await this.markLearningComplete(context, state, userId, learningId);
        await this.conversationState.saveChanges(context);
        return;
      }

      if (context.activity.value?.action === "submit_survey") {
        await this.submitSurvey(context, state, userId, context.activity.value);
        await this.conversationState.saveChanges(context);
        return;
      }

      if (context.activity.value?.action === "view_learning") {
        await context.sendActivity(
          "This experience has been updated. Use `/learning` to view your assigned module."
        );
        return;
      }

      if (state.inQuiz) {
        await this.handleQuizAnswer(context, state, userId, text);
        await this.conversationState.saveChanges(context);
        return;
      }

      if (assignment?.assignment?.canStart === false) {
        await context.sendActivity(
          "You're doing great! Next module will unlock soon. I'll remind you when it's ready."
        );
      } else {
        await context.sendActivity(
          "Say `start quiz` when you're ready, or `/learning` to view your assignment."
        );
      }
    });

    this.onMembersAdded(async (context, next) => {
      for (const member of context.activity.membersAdded) {
        if (member.id !== context.activity.recipient.id) {
          await this.ensureUserExists(context, member.id, member.name);
          await context.sendActivity(
            `👋 **Welcome to AI Champions Bot, ${member.name}!**\nI'll assign your first AI learning shortly.`
          );
        }
      }
      await next();
    });
  }

  async markLearningComplete(context, state, userId, learningId) {
    if (!learningId) {
      await context.sendActivity("I couldn't identify the learning module to complete.");
      return;
    }

    try {
      const res = await httpFetch(`${appUrl}/api/learning`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learningId, userId, status: "completed" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        await context.sendActivity(body.error || "Couldn't mark the learning as completed.");
        return;
      }

      state.aiLearningId = learningId;
      state.aiLearningStatus = "completed";

      await context.sendActivity(
        "Great! Let's jump into the quiz. Type `start quiz` when ready—passing it unlocks the next step."
      );
    } catch (error) {
      console.error("[Bot] Failed to mark learning complete", error);
      await context.sendActivity("Sorry, I couldn't update your learning status. Try again later.");
    }
  }

  async submitSurvey(context, state, userId, payload) {
    const { learningId } = payload;
    if (!learningId) {
      await context.sendActivity("Missing learning reference—please try again.");
      return;
    }

    if (!payload.actionType || !payload.timeSaved || !payload.confidence) {
      await context.sendActivity("Please answer all required questions before submitting.");
      return;
    }

    const body = {
      learningId,
      userId,
      survey: {
        actionType: payload.actionType,
        timeSaved: payload.timeSaved,
        confidence: payload.confidence,
        notes: payload.notes || null,
      },
    };

    try {
      const res = await httpFetch(`${appUrl}/api/learning`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        await context.sendActivity(data.error || "Couldn't save that. Please try again.");
        return;
      }

      await context.sendActivity("🙌 Logged! I'll cue up your next learning once it's available.");
      const assignment = await fetchAssignment(userId);
      if (assignment?.assignment) {
        const card = buildLearningSummaryCard(assignment.assignment);
        if (card) {
          await context.sendActivity({ attachments: [card] });
        }
      }
    } catch (error) {
      console.error("[Bot] Failed to submit survey", error);
      await context.sendActivity("Something went wrong while saving that. Please try again.");
    }
  }

  async handleQuizAnswer(context, state, userId, rawText) {
    const answer = context.activity.value?.answer || rawText;
    const question = state.currentQuiz.questions[state.questionIndex];

    if (!question) {
      state.inQuiz = false;
      await context.sendActivity("I lost track of the question set. Let's start over soon.");
      return;
    }

    state.currentResponses.push({
      questionId: question.id,
      answer,
      answeredAt: new Date().toISOString(),
    });

    state.questionIndex += 1;

    if (state.questionIndex < state.currentQuiz.questions.length) {
      await this.sendQuestion(context, state);
      return;
    }

    await this.submitQuizAttempt(context, state, userId);
    await this.moveToNextQuiz(context, state);

    if (!state.inQuiz) {
      const card = buildSurveyCard(state.aiLearningId);
      await context.sendActivity({
        attachments: [card],
      });
    }
  }

  async submitQuizAttempt(context, state, userId) {
    if (!state.currentQuiz || !state.currentResponses.length) {
      await context.sendActivity("No answers were recorded—quiz cancelled.");
      state.currentResponses = [];
      return;
    }

    try {
      const res = await httpFetch(`${appUrl}/api/quiz/answer`, {
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
        const body = await res.json().catch(() => ({}));
        console.error("[Bot] Quiz submission failed", body.error || res.statusText);
        await context.sendActivity(body.error || "Couldn't submit that quiz. Try again later.");
      } else {
        const result = await res.json();
        await context.sendActivity(
          `📊 Quiz complete! Score: ${result.score.correct}/${result.score.total}. Result: ${result.result}.`
        );
      }
    } catch (error) {
      console.error("[Bot] Error submitting quiz attempt", error);
      await context.sendActivity("I hit an error while logging your answers. Please try again later.");
    }

    state.currentResponses = [];
  }

  async moveToNextQuiz(context, state) {
    state.currentQuizIndex = (state.currentQuizIndex || 0) + 1;

    if (state.currentQuizIndex < state.allQuizzes.length) {
      state.currentQuiz = state.allQuizzes[state.currentQuizIndex];
      state.questionIndex = 0;
      state.currentResponses = [];
      await context.sendActivity(
        `Next quiz: **${state.currentQuiz.title}**. Let's keep going!`
      );
      await this.sendQuestion(context, state);
      return;
    }

    state.inQuiz = false;
    state.currentQuiz = null;
    state.allQuizzes = [];
    state.questionIndex = 0;
    state.currentResponses = [];
    await context.sendActivity(
      "🎉 All quizzes completed! Tell me about your AI win to unlock the next module."
    );
  }

  async ensureUserExists(context, userId, userName) {
    const fallback = {
      id: userId,
      name: userName,
      designation: "Member",
      lastSeenAt: new Date().toISOString(),
    };

    try {
      const member = await TeamsInfo.getMember(context, userId);
      let teams = null;
      if (context.activity.channelData && context.activity.channelData.team) {
        teams = await TeamsInfo.getTeamDetails(context);
      }

      const profile = {
        id: userId,
        name: userName || `${member?.givenName || ""} ${member?.surname || ""}`.trim(),
        email: (member?.email || member?.userPrincipalName || "").toLowerCase() || null,
        designation: member?.jobTitle || member?.userRole || fallback.designation,
        teamId: teams?.id || member?.tenantId || null,
        teamName: teams?.name || teams?.displayName || null,
        lastSeenAt: new Date().toISOString(),
      };

      await upsertUserProfile(profile);
    } catch (error) {
      console.error("[Bot] Unable to load Teams profile", error);
      await upsertUserProfile(fallback);
    }
  }

  async sendQuestion(context, state) {
    const question = state.currentQuiz.questions[state.questionIndex];
    if (!question) {
      await context.sendActivity("I couldn't find that question—let's stop here.");
      state.inQuiz = false;
      return;
    }

    const text = question.text || question.question || question.title;
    const options = question.options || question.choices || question.answers || [];
    const normalized = Array.isArray(options) ? options : Object.values(options);

    if (!text || !normalized.length) {
      await context.sendActivity("This question looks empty—skipping.");
      state.inQuiz = false;
      return;
    }

    const card = CardFactory.adaptiveCard({
      $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
      version: "1.4",
      type: "AdaptiveCard",
      body: [
        {
          type: "TextBlock",
          text: `Question ${state.questionIndex + 1}/${state.currentQuiz.questions.length}`,
          weight: "bolder",
        },
        {
          type: "TextBlock",
          text,
          wrap: true,
        },
      ],
      actions: normalized.map((option) => ({
        type: "Action.Submit",
        title: option,
        data: { answer: option },
      })),
    });

    await context.sendActivity({ attachments: [card] });
  }
}

module.exports.TeamsBot = TeamsBot;
