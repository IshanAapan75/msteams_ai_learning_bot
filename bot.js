const { TeamsActivityHandler, CardFactory } = require("botbuilder");
const { TeamsInfo } = require("botbuilder");
const { upsertUserProfile } = require("./lib/users");
const { containers } = require("./lib/cosmos");
const { syncLearningAssignment } = require("./lib/learningPlan.js");
const appUrl = process.env.APP_URL || "http://localhost:3000";

const httpFetch = (...args) =>
  typeof fetch === "function"
    ? fetch(...args)
    : import("node-fetch").then(({ default: fetchImpl }) => fetchImpl(...args));

const MINUTES_TO_MS = 60 * 1000;
const LEARNING_START_DELAY_MINUTES = Number(process.env.AI_LEARNING_START_DELAY_MINUTES ?? 5);
const QUIZ_START_DELAY_MINUTES = Number(process.env.AI_QUIZ_START_DELAY_MINUTES ?? 5);
const USAGE_START_DELAY_MINUTES = Number(process.env.AI_USAGE_START_DELAY_MINUTES ?? 5);

function computeStartTimestamp(delayMinutes) {
  const minutes = Number.isFinite(Number(delayMinutes)) ? Number(delayMinutes) : 0;
  const ms = Math.max(0, minutes) * MINUTES_TO_MS;
  return new Date(Date.now() + ms).toISOString();
}

function formatTimeRemaining(targetIso) {
  if (!targetIso) {
    return null;
  }
  const target = new Date(targetIso).getTime();
  if (Number.isNaN(target)) {
    return null;
  }
  const diffMs = target - Date.now();
  if (diffMs <= 0) {
    return null;
  }
  const totalMinutes = Math.ceil(diffMs / MINUTES_TO_MS);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (hours > 0) {
    parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  }
  if (!parts.length) {
    parts.push("less than a minute");
  }
  return parts.join(" and ");
}

function buildDelayMessage(activityLabel, targetIso) {
  const remaining = formatTimeRemaining(targetIso);
  if (!remaining) {
    return null;
  }
  return `⏳ ${activityLabel} unlocks in ${remaining}. I'll remind you when it's ready.`;
}

async function loadLearningEntry(userId, learningId) {
  if (!userId || !learningId) {
    return null;
  }
  try {
    const { resources } = await containers.responses.items
      .query({
        query: "SELECT * FROM c WHERE c.userId = @userId",
        parameters: [{ name: "@userId", value: userId }],
      })
      .fetchAll();
    const doc = resources?.[0];
    if (!doc || !Array.isArray(doc.learnings)) {
      return null;
    }
    return doc.learnings.find((entry) => entry.learningId === learningId) || null;
  } catch (error) {
    console.error("[Bot] Failed to load learning entry", error);
    return null;
  }
}

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

  const startAt = assignment.availableAt || assignment.assignedAt;
  assignment.canStart = !startAt || new Date() >= new Date(startAt);

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
    try {
        const querySpec = {
            query: "SELECT * FROM c WHERE c.userId = @userId",
            parameters: [{ name: "@userId", value: userId }]
        };
        const { resources: userResponses } = await containers.responses.items.query(querySpec).fetchAll();

        if (!userResponses || userResponses.length === 0) {
            return null;
        }

        const userResponse = userResponses[0];
        const activeLearning = userResponse.learnings.find(l => l.status !== 'completed');

        if (!activeLearning) {
            return null;
        }

        activeLearning.availableAt = activeLearning.availableAt || activeLearning.assignedAt || new Date().toISOString();
        
        // The original function returned an object with an 'assignment' property.
        // I will replicate that structure.
        return { assignment: activeLearning };
    } catch (error) {
        console.error("Error fetching assignment from responses container:", error);
        return null;
    }
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

      const seenUsers = (context.turnState.get("handledUsers") || new Set());
      if (!seenUsers.has(userId)) {
        await this.ensureUserExists(context, userId, userName);
        seenUsers.add(userId);
        context.turnState.set("handledUsers", seenUsers);
      }

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

          // Check if user has a response document
          const querySpecUser = {
              query: "SELECT * FROM c WHERE c.userId = @userId",
              parameters: [{ name: "@userId", value: userId }]
          };
          const { resources: userResponses } = await containers.responses.items.query(querySpecUser).fetchAll();
      
          if (!userResponses || userResponses.length === 0) {
              // First time user, assign first learning module
              const querySpecModule = {
                  query: "SELECT * FROM c WHERE c[\"order\"] = 1"
              };
              const { resources: learningModules } = await containers.ai_learning.items.query(querySpecModule).fetchAll();
      
              if (learningModules.length > 0) {
                  const firstModule = learningModules[0];
                  const nowIso = new Date().toISOString();
                  const newResponse = {
                      id: `${userId}-${Date.now()}`,
                      userId: userId,
                      learnings: [{
                          learningId: firstModule.id,
                          status: "assigned",
                          createdAt: nowIso,
                          updatedAt: nowIso,
                          availableAt: computeStartTimestamp(LEARNING_START_DELAY_MINUTES),
                          module: firstModule,
                          attempts: [],
                          quizAvailableAt: null,
                          usageAvailableAt: null
                      }],
                      updatedAt: nowIso
                  };
                  await containers.responses.items.create(newResponse);
                  await context.sendActivity(
                    `📘 I've assigned **${firstModule.title || firstModule.topic || "your first learning"}**. Type \`/learning\` to open it.`
                  );
              }
          }
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
        if (assignment?.assignment) {
            if (assignment.assignment.status !== "completed") {
                await context.sendActivity(
                    "Please finish the current learning module before starting the quiz. Type `/learning` to view it."
                );
                return;
            }

            const learningEntry = await loadLearningEntry(userId, assignment.assignment.learningId);
            const quizAvailableAt = learningEntry?.quizAvailableAt;
            const delayMessage = buildDelayMessage("Quiz", quizAvailableAt);
            if (delayMessage) {
              await context.sendActivity(delayMessage);
              return;
            }
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

        const startsAt = assignment.assignment.availableAt;
        const delayMessage = buildDelayMessage("Learning", startsAt);
        if (delayMessage) {
          await context.sendActivity(delayMessage);
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
          const displayName = member?.name || member?.givenName || context.activity.from?.name || "there";
          await context.sendActivity(
            `👋 **Welcome to AI Champions Bot, ${displayName}!**\nI'll assign your first AI learning shortly.`
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
      const { resources: userResponses } = await containers.responses.items.query({
          query: "SELECT * FROM c WHERE c.userId = @userId",
          parameters: [{ name: "@userId", value: userId }]
      }).fetchAll();

      if (!userResponses || userResponses.length === 0) {
          await context.sendActivity("I couldn't find your learning progress.");
          return;
      }

      const userResponse = userResponses[0];
      const learning = userResponse.learnings.find(l => l.learningId === learningId);

      if (!learning) {
          await context.sendActivity("I couldn't find that learning module in your plan.");
          return;
      }

      learning.status = "completed";
      learning.completedAt = new Date().toISOString();
      learning.updatedAt = learning.completedAt;
      learning.quizAvailableAt = computeStartTimestamp(QUIZ_START_DELAY_MINUTES);
      learning.usageAvailableAt = null;

      await containers.responses.items.upsert(userResponse);

      state.aiLearningId = learningId;
      state.aiLearningStatus = "completed";

      const delayMessage = buildDelayMessage("Quiz", learning.quizAvailableAt);
      await context.sendActivity(
        delayMessage ||
          "Great! Let's jump into the quiz soon. Type `start quiz` when the timer ends to unlock the next step."
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

    try {
        const { resources: userResponses } = await containers.responses.items.query({
            query: "SELECT * FROM c WHERE c.userId = @userId",
            parameters: [{ name: "@userId", value: userId }]
        }).fetchAll();

        if (!userResponses || userResponses.length === 0) {
            await context.sendActivity("I couldn't find your learning progress.");
            return;
        }

        const userResponse = userResponses[0];
        const learning = userResponse.learnings.find(l => l.learningId === payload.learningId);

        if (!learning) {
            await context.sendActivity("I couldn't find that learning module in your plan.");
            return;
        }
        
        learning.survey = {
            actionType: payload.actionType,
            timeSaved: payload.timeSaved,
            confidence: payload.confidence,
            notes: payload.notes || null,
            submittedAt: new Date().toISOString()
        };
        learning.updatedAt = new Date().toISOString();

        if (learning.quizPassedAt) {
            const quizPassedAt = new Date(learning.quizPassedAt);
            const now = new Date();
            const diffInHours = (now - quizPassedAt) / (1000 * 60 * 60);

            if (diffInHours >= 1) {
                // Assign next learning module
                const currentOrder = learning.module.order;
                const nextOrder = currentOrder + 1;

                const { resources: nextModules } = await containers.ai_learning.items.query({
                    query: "SELECT * FROM c WHERE c.order = @order",
                    parameters: [{ name: "@order", value: nextOrder }]
                }).fetchAll();

                if (nextModules.length > 0) {
                    const nextModule = nextModules[0];
                    const nextAvailableAt = computeStartTimestamp(LEARNING_START_DELAY_MINUTES);
                    userResponse.learnings.push({
                        learningId: nextModule.id,
                        status: "assigned",
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        availableAt: nextAvailableAt,
                        module: nextModule,
                        attempts: [],
                        quizAvailableAt: null,
                        usageAvailableAt: null
                    });
                    await containers.responses.items.upsert(userResponse);
                    const delayMsg = buildDelayMessage("Next learning", nextAvailableAt) ||
                        "🙌 Logged! I've assigned your next learning module.";
                    await context.sendActivity(delayMsg);
                    return; // exit after assigning
                } else {
                    await containers.responses.items.upsert(userResponse);
                    await context.sendActivity("🙌 Logged! You have completed all available learning modules.");
                    return; // exit
                }
            }
        }
        
        await containers.responses.items.upsert(userResponse);
        const unlockAt = learning.quizPassedAt
            ? new Date(new Date(learning.quizPassedAt).getTime() + 60 * 60 * 1000).toISOString()
            : null;
        const waitingMsg = buildDelayMessage("Next learning", unlockAt) ||
            "🙌 Logged! Your next learning module will be available soon.";
        await context.sendActivity(waitingMsg);

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

        const { resources: userResponses } = await containers.responses.items.query({
            query: "SELECT * FROM c WHERE c.userId = @userId",
            parameters: [{ name: "@userId", value: userId }]
        }).fetchAll();

        if (userResponses.length > 0) {
            const userResponse = userResponses[0];
            const learning = userResponse.learnings.find(l => l.learningId === state.aiLearningId);
            if (learning) {
                learning.attempts = learning.attempts || [];
                learning.attempts.push(result);
                if (result.result === "passed") {
                    learning.quizPassedAt = new Date().toISOString();
                    learning.usageAvailableAt = computeStartTimestamp(USAGE_START_DELAY_MINUTES);
                }
                await containers.responses.items.upsert(userResponse);
            }
        }
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
      email: context?.activity?.from?.email || null,
      teamId: null,
      teamName: null,
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
        name:
          (userName || `${member?.givenName || ""} ${member?.surname || ""}` || member?.name || fallback.name || "")
            .trim()
            .replace(/\s+/g, " ") || fallback.name,
        email:
          (member?.email || member?.userPrincipalName || context?.activity?.from?.email || "")
            .toString()
            .toLowerCase()
            .trim() || null,
        designation: member?.jobTitle || member?.userRole || fallback.designation,
        teamId: teams?.id || member?.tenantId || null,
        teamName: teams?.name || teams?.displayName || null,
        lastSeenAt: new Date().toISOString(),
        manager: null,
        directReports: [],
      };

      await upsertUserProfile(profile);
    } catch (error) {
      console.error("[Bot] Unable to load Teams profile", error);
      console.warn("[Bot] Falling back to minimal profile for user", userId);
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
