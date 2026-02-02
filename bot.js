const { TeamsActivityHandler, CardFactory } = require("botbuilder");
const { TeamsInfo } = require("botbuilder");
const { upsertUserProfile } = require("./lib/users");
const { containers } = require("./lib/cosmos");
const { syncLearningAssignment, recordSurveyAndAssignNext } = require("./lib/learningPlan.js");
const { fetchResponseProgress, saveResponseProgress } = require("./lib/learningProgress.js");
const { awardXpAction } = require("./lib/rewards.js");
const appUrl = process.env.APP_URL || "http://localhost:3000";

const httpFetch = (...args) =>
  typeof fetch === "function"
    ? fetch(...args)
    : import("node-fetch").then(({ default: fetchImpl }) => fetchImpl(...args));

const HOURS_TO_MS = 60 * 60 * 1000;
const moduleCache = new Map();

async function loadModuleDetails(learningId) {
  if (!learningId) {
    return null;
  }

  if (moduleCache.has(learningId)) {
    return moduleCache.get(learningId);
  }

  try {
    const { resource } = await containers.ai_learning.item(learningId, learningId).read();
    moduleCache.set(learningId, resource || null);
    return resource || null;
  } catch (error) {
    try {
      const { resources } = await containers.ai_learning.items
        .query({ query: "SELECT * FROM c WHERE c.id = @id", parameters: [{ name: "@id", value: learningId }] })
        .fetchAll();
      const module = resources?.[0] || null;
      moduleCache.set(learningId, module);
      return module;
    } catch (nestedError) {
      console.warn("[Bot] Unable to load module details", learningId, nestedError);
      moduleCache.set(learningId, null);
      return null;
    }
  }
}
const LEARNING_START_DELAY_MINUTES = Number(
  process.env.MICRO_LEARNING_START_DELAY_MINUTES ?? process.env.AI_LEARNING_START_DELAY_MINUTES ?? 0
);
const NEXT_LEARNING_DELAY_HOURS = Number(
  process.env.MICRO_LEARNING_NEXT_DELAY_HOURS ?? process.env.AI_NEXT_LEARNING_DELAY_HOURS ?? 18
);
const DEFAULT_LANGUAGE = "English";

async function loadLearningEntry(userId, learningId) {
  if (!userId || !learningId) {
    return null;
  }
  try {
    const doc = await fetchResponseProgress(userId);
    if (!doc || !Array.isArray(doc.learnings)) {
      return null;
    }
    return doc.learnings.find((entry) => entry.learningId === learningId) || null;
  } catch (error) {
    console.error("[Bot] Failed to load learning entry", error);
    return null;
  }
}

function getQuizPassedTimestamp(entry) {
  if (!entry) {
    return null;
  }

  if (entry.quizPassedAt) {
    return entry.quizPassedAt;
  }

  if (!Array.isArray(entry.attempts)) {
    return null;
  }

  const passedAttempts = entry.attempts
    .map((attempt) => {
      if (!attempt || attempt.result !== "passed") {
        return null;
      }
      return attempt.submittedAt || attempt.completedAt || attempt.assignedAt || null;
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return passedAttempts[0] || null;
}

function hasPassedQuiz(entry) {
  return Boolean(getQuizPassedTimestamp(entry));
}

function findUsageEligibleLearning(progressDoc) {
  if (!progressDoc || !Array.isArray(progressDoc.learnings)) {
    return null;
  }

  const sorted = [...progressDoc.learnings].sort((a, b) => {
    const timeA = new Date(getQuizPassedTimestamp(a) || a.completedAt || 0).getTime();
    const timeB = new Date(getQuizPassedTimestamp(b) || b.completedAt || 0).getTime();
    return timeB - timeA;
  });

  return sorted.find((entry) => hasPassedQuiz(entry) && !(entry.survey?.submittedAt));
}



function buildDelayMessage(label, timestampIso) {
  if (!timestampIso) {
    return null;
  }

  const target = new Date(timestampIso);
  if (Number.isNaN(target.getTime())) {
    return null;
  }

  const remainingMs = target.getTime() - Date.now();
  if (remainingMs <= 0) {
    return null;
  }

  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes}m`);
  }
  const relative = parts.join(" ");
  return `⏳ ${label} unlocks in ${relative} (at ${target.toLocaleString()}). I'll remind you when it's ready.`;
}

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
  statusFacts.push({ title: "Status", value: assignment.status || "available" });
  if (assignment.availableAt) {
    statusFacts.push({ title: "Available", value: new Date(assignment.availableAt).toLocaleString() });
  }
  if (assignment.completedAt) {
    statusFacts.push({ title: "Completed", value: new Date(assignment.completedAt).toLocaleString() });
  }
  const quizPassedTimestamp = getQuizPassedTimestamp(assignment);
  if (quizPassedTimestamp) {
    statusFacts.push({ title: "Quiz", value: `Passed ${new Date(quizPassedTimestamp).toLocaleString()}` });
  }

  const body = [
    ...lines,
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
      title: "Learning Complete",
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
      text: "How confident are you in the quality of the AI output?",
      wrap: true,
      spacing: "medium",
    },
    {
      type: "Input.ChoiceSet",
      id: "survey_confidence",
      style: "expanded",
      isRequired: true,
      errorMessage: "Please rate your confidence",
      choices: [
        { title: "1 - Low", value: "1" },
        { title: "2", value: "2" },
        { title: "3 - Medium", value: "3" },
        { title: "4", value: "4" },
        { title: "5 - High", value: "5" },
      ],
    },
    {
      type: "TextBlock",
      text: "How do you feel about AI right now?",
      wrap: true,
      spacing: "medium",
    },
    {
      type: "Input.ChoiceSet",
      id: "survey_sentiment",
      style: "expanded",
      isRequired: true,
      errorMessage: "Please rate your sentiment",
      choices: [
        { title: "1 - Frustrated/Anxious", value: "1" },
        { title: "2 - Skeptical", value: "2" },
        { title: "3 - Neutral", value: "3" },
        { title: "4 - Curious", value: "4" },
        { title: "5 - Confident/Excited", value: "5" },
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

function buildAssessmentResultsCard(score, levelLabel) {
  // Map levels to colors
  const levelColors = {
      'AI Rookie': 'attention',
      'AI Learner': 'warning',
      'AI Explorer': 'accent',
      'AI Practitioner': 'accent',
      'AI Expert': 'good',
      'AI Champion': 'good'
  };

  const scoreColor = levelColors[levelLabel];
  
  return CardFactory.adaptiveCard({
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    type: "AdaptiveCard",
    body: [
      {
        type: "TextBlock",
        text: "Assessment Complete! 🎉",
        weight: "bolder",
        size: "large",
        horizontalAlignment: "center",
      },
      {
        type: "TextBlock",
        text: "Here's your AI Fluency profile",
        horizontalAlignment: "center",
        isSubtle: true,
      },
      {
        type: "TextBlock",
        text: `${score}`,
        size: "extraLarge",
        weight: "bolder",
        horizontalAlignment: "center",
        color: scoreColor,
      },
      {
        type: "TextBlock",
        text: `You are an **${levelLabel}**`,
        horizontalAlignment: "center",
        spacing: "none",
      },
    ],
  });
}

function buildAssessmentInputSection(question) {
  const base = [
    {
      type: "TextBlock",
      text: question.text,
      wrap: true,
      weight: "bolder",
      spacing: "medium",
    },
  ];

  const isObjectOptions = question.options?.length && typeof question.options[0] === "object";
  const choices = (question.options || []).map((option, index) =>
    typeof option === "string"
      ? { title: option, value: String(index) }
      : { title: option.text, value: String(option.value) }
  );

  base.push({
    type: "Input.ChoiceSet",
    id: `assessment_${question.id}`,
    style: "expanded",
    isRequired: true,
    errorMessage: "Please select an option",
    choices,
  });

  return base;
}

function buildFullAssessmentCard(questions = []) {
  const sections = questions.flatMap((question) => buildAssessmentInputSection(question));

  return CardFactory.adaptiveCard({
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    type: "AdaptiveCard",
    body: [
      {
        type: "TextBlock",
        text: "🧠 AI Fluency Diagnostic",
        weight: "bolder",
        size: "large",
      },
      {
        type: "TextBlock",
        text: "Answer all questions below to unlock your personalized learning plan.",
        isSubtle: true,
        wrap: true,
      },
      ...sections,
    ],
    actions: [
      {
        type: "Action.Submit",
        title: "Submit assessment",
        data: { action: "submit_full_assessment" },
      },
    ],
  });
}

async function fetchAssignment(userId) {
  try {
    // Prefer the normalized assignment which includes module metadata
    const { assignment } = await syncLearningAssignment(userId);
    if (assignment) {
      return { assignment };
    }

    // Fallback to raw progress data if the sync API returned nothing
    const userResponse = await fetchResponseProgress(userId);
    if (!userResponse || !Array.isArray(userResponse.learnings) || userResponse.learnings.length === 0) {
      return null;
    }

    const activeLearnings = userResponse.learnings
      .filter((entry) => entry.status !== "completed" || !hasPassedQuiz(entry))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const activeLearning = activeLearnings[0];

    if (!activeLearning) {
      return null;
    }

    // Fallback: If module metadata or order is missing, fetch it from catalog
    if (!activeLearning.module || typeof activeLearning.module.order !== 'number') {
        const { resources } = await containers.ai_learning.items.query({
            query: "SELECT * FROM c WHERE c.id = @id",
            parameters: [{ name: "@id", value: activeLearning.learningId }]
        }).fetchAll();
        
        if (resources.length > 0) {
            activeLearning.module = resources[0];
            // Persist the fix back to the document for future requests
            await saveResponseProgress(userResponse);
        }
    }

    const normalizedAvailableAt = activeLearning.availableAt || activeLearning.assignedAt || new Date().toISOString();

    let normalizedModule = activeLearning.module;
    if (!normalizedModule) {
      // Try to hydrate module details from catalog if missing
      try {
        const { resources: catalogModules } = await containers.ai_learning.items
          .query({ query: "SELECT * FROM c WHERE c.id = @id", parameters: [{ name: "@id", value: activeLearning.learningId }] })
          .fetchAll();
        normalizedModule = catalogModules[0] || null;
      } catch (moduleError) {
        console.warn("[Bot] Unable to hydrate module metadata", moduleError);
      }

      normalizedModule =
        normalizedModule || {
          id: activeLearning.learningId,
          topic: activeLearning.topic || activeLearning.title || "Learning module",
          title: activeLearning.title || activeLearning.topic || activeLearning.learningId,
          description: activeLearning.description || "",
          details: activeLearning.details || "",
          level: activeLearning.level || "",
          quizzes: activeLearning.quizzes || [],
        };
    }

    if (!activeLearning.availableAt || !activeLearning.module) {
      activeLearning.availableAt = activeLearning.availableAt || normalizedAvailableAt;
      activeLearning.module = activeLearning.module || normalizedModule;
      await saveResponseProgress(userResponse);
    }

    return {
      assignment: {
        ...activeLearning,
        availableAt: normalizedAvailableAt,
        module: normalizedModule,
      },
    };
  } catch (error) {
    console.error("Error fetching assignment:", error);
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
        assessmentCompleted: false,
        microLearningId: null,
        microLearningStatus: "available",
        microLearningQuizzes: [],
        currentQuiz: null,
        questionIndex: 0,
        currentResponses: [],
        language: DEFAULT_LANGUAGE,
        assessmentQuestions: [],
        assessmentScoringConfig: null,
      });

      const profile = await getUserProfile(userId);
      if (profile) {
        state.language = state.language || profile.language || null;
        state.microLearningId = state.microLearningId || profile.lastCompletedLearningId || null;
      }

      if (!state.language) {
        state.language = DEFAULT_LANGUAGE;
        await updateUserLanguage(userId, DEFAULT_LANGUAGE).catch((error) =>
          console.warn("[Bot] Unable to persist default language", error)
        );
        await context.sendActivity(
          "🌐 I've set your language preference to English so you can start learning right away. You can change this later from the dashboard."
        );
      }

      // Sync assessment status from DB if currently false in state
      if (!state.assessmentCompleted) {
          const { resources: assessmentResponses } = await containers.assessmentresponse.items
            .query({
              query: "SELECT * FROM c WHERE c.userId = @userId",
              parameters: [{ name: "@userId", value: userId }],
            })
            .fetchAll();
          
          if (assessmentResponses.length > 0) {
              console.log(`[Bot] Assessment found in DB for user: ${userId}. Syncing state.`);
              state.assessmentCompleted = true;
          }
      }

      // Automatically trigger assessment for new users
      if (!state.assessmentCompleted && text !== "/assessment" && context.activity.value?.action !== "submit_full_assessment") {
          console.log(`[Bot] User ${userId} has not completed assessment. Triggering diagnostic.`);
          await this.handleAssessmentCommand(context, state, userId);
          await this.conversationState.saveChanges(context);
          return;
      }

      // Check for current assignment
      let assignment = await fetchAssignment(userId);

      // If assessment is done but NO active assignment exists (everything fully cleared), 
      // check if we need to assign the first one OR the next one
      if (state.assessmentCompleted && !assignment) {
        const userResponse = await fetchResponseProgress(userId);
        if (!userResponse.learnings || userResponse.learnings.length === 0) {
            console.log(`[Bot] User ${userId} has no history. Assigning first module.`);
            await this.assignFirstLearningModule(context, userId);
        } else {
            console.log(`[Bot] User ${userId} cleared all tasks. Checking for next module.`);
            await this.ensureNextLearningQueued(userId);
        }
        assignment = await fetchAssignment(userId);
      }

      if (assignment?.assignment) {
        const active = assignment.assignment;
        console.log(`[Bot] Assignment state: ID=${active.learningId}, Status=${active.status}`);
        state.microLearningId = active.learningId || state.microLearningId;
        state.microLearningStatus = active.status || state.microLearningStatus;
        state.microLearningQuizzes = active.module?.quizzes || state.microLearningQuizzes;
      }

      if (text === "start quiz") {
        if (!assignment) {
          await context.sendActivity("I couldn't find a learning module ready for a quiz. Please check `/learning` to see your progress.");
          return;
        }

        const activeLearning = assignment?.assignment;

        if (activeLearning && activeLearning.status !== "completed") {
          await context.sendActivity(
            "Please finish the current learning module before starting the quiz. Type `/learning` to view it."
          );
          return;
        }

        const candidateLearningId = activeLearning?.learningId || state.microLearningId;
        const candidateStatus = activeLearning?.status || state.microLearningStatus;

        let learningEntry = null;
        if (candidateLearningId) {
          learningEntry = await loadLearningEntry(userId, candidateLearningId);
        }

        if (!learningEntry) {
          await context.sendActivity(
            "I couldn't find a completed learning module ready for a quiz yet. Please complete a module first."
          );
          return;
        }

        const effectiveStatus = (candidateStatus || learningEntry.status || "").toLowerCase();
        if (effectiveStatus !== "completed") {
          await context.sendActivity(
            "Please finish the current learning module before starting the quiz. Type `/learning` to view it."
          );
          return;
        }

        const derivedLearningId = learningEntry.learningId || candidateLearningId;
        const derivedQuizzes = activeLearning?.module?.quizzes || learningEntry?.module?.quizzes || state.microLearningQuizzes;

        state.microLearningId = derivedLearningId || state.microLearningId;
        state.microLearningQuizzes = derivedQuizzes || state.microLearningQuizzes;

        const quizPayload = {
          userId,
          fetchAll: true,
          microLearningId: state.microLearningId,
          microLearningQuizzes: state.microLearningQuizzes,
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
        state.microLearningId = data.microLearningId;
        state.microLearningStatus = data.microLearningStatus;

        await context.sendActivity(
          `🎯 Starting quiz for ${state.currentQuiz.title}. Answer each question to proceed.`
        );
        await this.sendQuestion(context, state);
        await this.conversationState.saveChanges(context);
        return;
      }

      if (text === "/learning") {
        console.log(`[Bot] /learning command received from user: ${userId}`);
        if (!assignment?.assignment) {
          console.log(`[Bot] No active assignment found for user: ${userId} during /learning command.`);
          await context.sendActivity("I couldn't find any learning modules for you yet.");
          return;
        }

        console.log(`[Bot] Rendering learning card for: ${assignment.assignment.learningId}`);
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

      if (text === "/logusage") {
        const progress = await fetchResponseProgress(userId);
        const activeLearning = assignment?.assignment;
        let targetLearning = null;

        if (activeLearning?.learningId) {
          targetLearning = await loadLearningEntry(userId, activeLearning.learningId);
        }

        if (!targetLearning || targetLearning.survey?.submittedAt || !hasPassedQuiz(targetLearning)) {
          targetLearning = findUsageEligibleLearning(progress);
        }

        if (!targetLearning || !hasPassedQuiz(targetLearning)) {
          await context.sendActivity(
            "I couldn't find a completed learning module ready for usage logging yet. Please finish a quiz first."
          );
          return;
        }

        if (targetLearning.survey?.submittedAt) {
          await context.sendActivity("You've already logged a usage win for this module. Great job!");
          return;
        }

        const surveyCard = buildSurveyCard(targetLearning.learningId);
        await context.sendActivity({ attachments: [surveyCard] });
        return;
      }

      if (text === "/myusage") {
        try {
          const { resources: userUsages } = await containers.userusage.items
            .query({
              query: "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.timestamp DESC",
              parameters: [{ name: "@userId", value: userId }],
            })
            .fetchAll();

          if (!userUsages || userUsages.length === 0) {
            await context.sendActivity("You haven't logged any AI usage yet. Use `/logusage` to get started!");
            return;
          }

          let responseMessage = "Here are your logged AI usages:\n\n";
          userUsages.forEach((usage, index) => {
            responseMessage += `**Usage Entry ${index + 1}:**\n`;
            responseMessage += `  **Timestamp:** ${new Date(usage.timestamp).toLocaleString()}\n`;
            responseMessage += `  **Learning ID:** ${usage.learningId || 'N/A'}\n`;
            responseMessage += `  **What did you use AI for?** ${usage.responses.actionType || 'N/A'}\n`;
            responseMessage += `  **How much time did you save?** ${usage.responses.timeSaved || 'N/A'}\n`;
            responseMessage += `  **Confidence in output quality:** ${usage.responses.confidence || 'N/A'}\n`;
            if (usage.responses.notes) {
              responseMessage += `  **Notes:** ${usage.responses.notes}\n`;
            }
            responseMessage += "\n";
          });

          await context.sendActivity(responseMessage);

        } catch (error) {
          console.error("[Bot] Failed to fetch user usages", error);
          await context.sendActivity("Sorry, I couldn't retrieve your AI usages right now.");
        }
        return;
      }

      if (text === "/assessment") {
        await this.handleAssessmentCommand(context, state, userId);
        await this.conversationState.saveChanges(context);
        return;
      }

      if (context.activity.value?.action === "submit_full_assessment") {
        await this.handleFullAssessmentSubmission(context, state, userId, context.activity.value);
        await this.conversationState.saveChanges(context);
        return;
      }

      if (context.activity.value?.action === "submit_assessment_answer") {
        await this.handleAssessmentAnswer(context, state, userId, context.activity.value);
        await this.conversationState.saveChanges(context);
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
          "This experience has been updated. Use `/learning` to view your available module."
        );
        return;
      }

      if (state.inQuiz) {
        await this.handleQuizAnswer(context, state, userId, text);
        await this.conversationState.saveChanges(context);
        return;
      }

      if (state.inAssessment) {
        // This is a fallback if the user types instead of clicking a button.
        // The main logic is in `handleAssessmentAnswer` which is triggered by card actions.
        await context.sendActivity("Please use the buttons to answer the assessment question.");
        return;
      }

      if (text === "hi") {
        const { assignment, status } = await syncLearningAssignment(userId);

        if (state.assessmentCompleted) {
          try {
            const { resources: assessmentResponses } = await containers.assessmentresponse.items
              .query({
                query: "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.timestamp DESC",
                parameters: [{ name: "@userId", value: userId }],
              })
              .fetchAll();

            if (assessmentResponses.length > 0) {
              const latest = assessmentResponses[0];
              const resultsCard = buildAssessmentResultsCard(latest.fluencyScore, latest.fluencyLevel);
              await context.sendActivity({ attachments: [resultsCard] });
            }
          } catch (assessmentError) {
            console.warn("[Bot] Unable to load assessment results", assessmentError);
          }
        }

        if (status === "completed") {
          await context.sendActivity("You have completed all available learning modules. Great job!");
        } else if (assignment) {
          const startsAt = assignment.availableAt;
          const delayMessage = buildDelayMessage("Next learning", startsAt);
          if (delayMessage) {
            await context.sendActivity(delayMessage);
          } else {
            const card = buildLearningSummaryCard(assignment);
            if (card) {
              await context.sendActivity({ attachments: [card] });
            }
          }
        } else {
          await context.sendActivity("I couldn't find any learning modules for you yet.");
        }
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
            `👋 **Welcome to Momentum by AI Champions, ${displayName}!**\nLet's build your AI fluency together.`
          );
        }
      }
      await next();
    });
  }

  async assignFirstLearningModule(context, userId) {
    if (!userId) {
      return false;
    }

    try {
      const userResponse = await fetchResponseProgress(userId);

      if (userResponse.learnings && userResponse.learnings.length > 0) {
        return false;
      }

      // 1. Get User's Fluency Level
      const { resource: userProfile } = await containers.users.item(userId, userId).read();
      let userTier = userProfile?.fluencyLevel;

      // Cap the starting content tier at "AI Explorer"
      // Even if they are Practitioner/Expert/Champion, they start at the Explorer track.
      const highLevels = ['AI Practitioner', 'AI Expert', 'AI Champion'];
      if (highLevels.includes(userTier)) {
          userTier = 'AI Explorer';
      }

      let firstModule = null;

      // 2. Try to find content matching their tier
      if (userTier) {
          const { resources: tierModules } = await containers.ai_learning.items.query({
              query: "SELECT * FROM c WHERE c.tier = @tier ORDER BY c[\"order\"] ASC OFFSET 0 LIMIT 1",
              parameters: [{ name: "@tier", value: userTier }]
          }).fetchAll();
          
          if (tierModules.length > 0) {
              firstModule = tierModules[0];
          }
      }

      // 3. Fallback to Day 1 / Default content if no tier match
      if (!firstModule) {
          const { resources: defaultModules } = await containers.ai_learning.items
            .query({ query: "SELECT * FROM c WHERE c.id = 'micro-learning-day-1'" })
            .fetchAll();
          firstModule = defaultModules[0];
      }

      if (!firstModule) {
        return false;
      }

      const nowIso = new Date().toISOString();
      
      userResponse.learnings = [
        {
          learningId: firstModule.id,
          status: "available",
          createdAt: nowIso,
          updatedAt: nowIso,
          availableAt: nowIso,
          module: firstModule,
          attempts: [],
          quizAvailableAt: null,
          usageAvailableAt: null,
        },
      ];
      userResponse.updatedAt = nowIso;

      await saveResponseProgress(userResponse);
      await context.sendActivity(
        `📘 based on your level **${userTier || 'Beginner'}**, I've assigned **${firstModule.title || firstModule.topic}**. Type \`/learning\` to open it.`
      );
      return true;
    } catch (error) {
      console.error("[Bot] Failed to assign first learning module", error);
      return false;
    }
  }

  async handleAssessmentCommand(context, state, userId) {
    try {
      // Fetch questions and config in one go if possible, or parallel
      const { resources: allItems } = await containers.assessmentquestion.items.query("SELECT * FROM c").fetchAll();
      
      // Sort questions naturally (q1, q2, ... q10) instead of lexicographically (q1, q10, q2)
      const questions = allItems
        .filter(i => i.id !== 'scoring_config')
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
        
      const scoringConfig = allItems.find(i => i.id === 'scoring_config');

      const { resources: assessmentResponses } = await containers.assessmentresponse.items
        .query({
          query: "SELECT * FROM c WHERE c.userId = @userId",
          parameters: [{ name: "@userId", value: userId }],
        })
        .fetchAll();

      if (assessmentResponses.length > 0) {
        const latestResponse = assessmentResponses.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
        
        let levelLabel = latestResponse.fluencyLevel;
        if (!levelLabel && scoringConfig && latestResponse.fluencyScore !== undefined) {
             // Fallback: Calculate level if missing in record
             const score = latestResponse.fluencyScore;
             levelLabel = scoringConfig.fluencyLevels.find(level => score >= level.range[0] && score <= level.range[1])?.label || "Unknown";
        }

        await context.sendActivity("You have already completed the AI Fluency Diagnostic. Here are your results:");
        const resultsCard = buildAssessmentResultsCard(latestResponse.fluencyScore, levelLabel);
        await context.sendActivity({ attachments: [resultsCard] });
        return;
      }

      if (!questions || questions.length === 0) {
        await context.sendActivity("I couldn't find any assessment questions right now. Please try again later.");
        return;
      }

      state.assessmentQuestions = questions;

      const assessmentCard = buildFullAssessmentCard(state.assessmentQuestions);
      await context.sendActivity({ attachments: [assessmentCard] });

    } catch (error) {
      console.error("[Bot] Failed to handle assessment command", error);
      await context.sendActivity("Sorry, I ran into an error while trying to start the assessment.");
    }
  }

  async handleFullAssessmentSubmission(context, state, userId, value) {
    try {
      const answers = [];
      
      // Transform card values to API expected format
      for (const question of state.assessmentQuestions) {
        const rawValue = value[`assessment_${question.id}`];
        if (rawValue !== undefined && rawValue !== "") {
          let answer;
          
          if (question.type === 'mcq') {
            // MCQs use index as value
            answer = parseInt(rawValue, 10);
          } else if (question.type === 'self_assessment') {
             // Confidence questions use numeric values (1-5)
             answer = parseInt(rawValue, 10);
             if (isNaN(answer)) answer = rawValue; // Fallback
          } else {
             // Usage frequency and others might be strings or numbers
             // Try parsing as int, if it matches an option value that is a number
             const asInt = parseInt(rawValue, 10);
             const optionWithInt = question.options.find(o => o.value === asInt);
             if (optionWithInt) {
                 answer = asInt;
             } else {
                 answer = rawValue;
             }
          }

          answers.push({
            questionId: question.id,
            answer: answer
          });
        }
      }

      const res = await httpFetch(`${appUrl}/api/assessment/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, answers }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error || "API request failed");
      }

      const result = await res.json();
      
      // Mark assessment as completed in state to allow further commands immediately
      state.assessmentCompleted = true;

      const resultsCard = buildAssessmentResultsCard(result.fluencyScore, result.fluencyLevel);
      await context.sendActivity({ attachments: [resultsCard] });

      const helpMessage = `🎉 **Diagnostic Complete!** Here are the commands you can use:
• \`/learning\` - View your currently assigned AI learning module.
• \`start quiz\` - Start the quiz for your completed learning module.
• \`/logusage\` - Capture an "AI win" by logging how you used AI today.
• \`/myusage\` - View your previous AI usage logs.
• \`/assessment\` - View your latest diagnostic results.`;

      await context.sendActivity(helpMessage);

      const assigned = await this.assignFirstLearningModule(context, userId);
      if (assigned) {
        await context.sendActivity("📘 Let's get started! Type `/learning` to open your first module.");
      } else {
        const assignment = await fetchAssignment(userId);
        if (assignment?.assignment) {
          await context.sendActivity(
            "📘 You're all set. Type `/learning` to continue with your personalized module."
          );
        }
      }

    } catch (error) {
      console.error("[Bot] Failed to handle full assessment submission", error);
      await context.sendActivity("Sorry, I ran into an error while submitting your assessment. Please try again.");
    }
  }

  async markLearningComplete(context, state, userId, learningId) {
    if (!learningId) {
      await context.sendActivity("I couldn't identify the learning module to complete.");
      return;
    }

    try {
      const userResponse = await fetchResponseProgress(userId);

      if (!userResponse || !userResponse.learnings) {
          await context.sendActivity("I couldn't find your learning progress.");
          return;
      }

      const learning = userResponse.learnings.find(l => l.learningId === learningId);

      if (!learning) {
          await context.sendActivity("I couldn't find that learning module in your plan.");
          return;
      }

      learning.status = "completed";
      learning.completedAt = new Date().toISOString();
      learning.updatedAt = learning.completedAt;
      learning.quizAvailableAt = null;
      learning.usageAvailableAt = null;

      await saveResponseProgress(userResponse);

      await this.awardLearningCompletion(userId, learningId);

      state.microLearningId = learningId;
      state.microLearningStatus = "completed";

      await context.sendActivity(
        "✅ **Learning marked complete!**\n\nYou can start the quiz right away by typing `start quiz`."
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

    const confidenceValue = payload.survey_confidence ?? payload.confidence;
    const sentimentValue = payload.survey_sentiment ?? payload.sentiment;

    if (!payload.actionType || !payload.timeSaved || !confidenceValue || !sentimentValue) {
        await context.sendActivity("Please answer all required questions before submitting.");
        return;
    }

    try {
        const userResponse = await fetchResponseProgress(userId);

        if (!userResponse || !Array.isArray(userResponse.learnings)) {
            await context.sendActivity("I couldn't find your learning progress.");
            return;
        }

        const learning = userResponse.learnings.find(l => l.learningId === payload.learningId);

        if (!learning) {
            await context.sendActivity("I couldn't find that learning module in your plan.");
            return;
        }

        const submittedAt = new Date();
        const submittedAtIso = submittedAt.toISOString();

        // Create the new usage document
        const usageDoc = {
            id: `${userId}-${learningId}-${Date.now()}`,
            userId: userId,
            learningId: learningId,
            timestamp: submittedAtIso,
            questions: [
                { id: "actionType", text: "What did you use AI for?" },
                { id: "timeSaved", text: "How much time did you save?" },
                { id: "confidence", text: "Confidence in output quality" },
                { id: "sentiment", text: "How do you feel about AI right now?" },
                { id: "notes", text: "Brief description" }
            ],
            responses: {
                actionType: payload.actionType,
                timeSaved: payload.timeSaved,
                confidence: confidenceValue,
                sentiment: sentimentValue,
                notes: payload.notes || null
            }
        };

        // Save to the new container
        await containers.userusage.items.create(usageDoc);
        
        // Mark survey as submitted in the original responses document
        learning.survey = {
            actionType: payload.actionType,
            timeSaved: payload.timeSaved,
            confidence: confidenceValue,
            sentiment: sentimentValue,
            notes: payload.notes || null,
            submittedAt: submittedAtIso
        };
        learning.updatedAt = submittedAtIso;
        learning.usageAvailableAt = null;
        learning.surveyCompletedAt = submittedAtIso;

        await saveResponseProgress(userResponse);
        await recordSurveyAndAssignNext({
            userId,
            learningId,
            survey: {
                actionType: payload.actionType,
                timeSaved: payload.timeSaved,
                confidence: confidenceValue,
                sentiment: sentimentValue,
                notes: payload.notes || null,
                submittedAt: submittedAtIso,
            },
        });
        
        const fallbackUnlock = new Date(new Date(submittedAtIso).getTime() + NEXT_LEARNING_DELAY_HOURS * HOURS_TO_MS).toISOString();
        const waitingMsg =
            buildDelayMessage("Next learning", fallbackUnlock) ||
            "🙌 Logged! Your next learning module will be available soon.";
        await context.sendActivity(waitingMsg);

        await this.awardUsageLogging(userId, learning.learningId, payload);

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
          microLearningId: state.microLearningId,
          microLearningStatus: state.microLearningStatus,
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

        const userResponse = await fetchResponseProgress(userId);

        let quizPassed = false;
        const learning = userResponse?.learnings?.find((entry) => entry.learningId === state.microLearningId);
        if (learning) {
          learning.attempts = Array.isArray(learning.attempts) ? learning.attempts : [];
          learning.attempts.push(result);
          if (result.result === "passed") {
            learning.quizPassedAt = new Date().toISOString();
            learning.usageAvailableAt = null;
            quizPassed = true;
          }
          await saveResponseProgress(userResponse);
        }

        if (quizPassed) {
          await this.promptUsageAndWrapUp(context, { userId, ensureNextLearning: true });
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

  async awardLearningCompletion(userId, learningId) {
    if (!userId || !learningId) {
      return;
    }
    try {
      await awardXpAction({
        userId,
        actionType: "micro-learning",
        metadata: {
          details: {
            learningId,
          },
        },
      });
    } catch (error) {
      console.error("[Bot] Failed to award learning XP", error);
    }
  }

  async awardUsageLogging(userId, learningId, payload) {
    if (!userId || !learningId) {
      return;
    }
    try {
      await awardXpAction({
        userId,
        actionType: "ai-usage",
        metadata: {
          details: {
            learningId,
            actionType: payload?.actionType || null,
            timeSaved: payload?.timeSaved || null,
          },
        },
      });
    } catch (error) {
      console.error("[Bot] Failed to award usage XP", error);
    }
  }

  async promptUsageLogging(context) {
    await context.sendActivity(
      "📝 Once you're ready, capture today's AI win by typing `/logusage` to log your usage."
    );
  }

  async sendDailyWrapUp(context) {
    await context.sendActivity("✅ That's all for today! Come back tomorrow for your next learning drop.");
  }

  async promptUsageAndWrapUp(context, { ensureNextLearning = false, userId } = {}) {
    await this.promptUsageLogging(context);
    await context.sendActivity("✅ Next learning module is assigned. Please come back tomorrow!");

    if (ensureNextLearning && userId) {
      await this.ensureNextLearningQueued(userId);
    }
  }

  async ensureNextLearningQueued(userId) {
    if (!userId) {
      return;
    }

    try {
      const existing = await fetchAssignment(userId);
      // If we already have an active/available module, don't queue another
      if (existing?.assignment && existing.assignment.status !== 'completed') {
        return;
      }

      // Assign next module with 18 hour delay
      const catalog = await containers.ai_learning.items.query("SELECT * FROM c ORDER BY c[\"order\"] ASC").fetchAll();
      const { resources: modules } = catalog;
      
      const userResponse = await fetchResponseProgress(userId);

      if (userResponse.learnings && userResponse.learnings.length > 0) {
          const lastLearning = userResponse.learnings[userResponse.learnings.length - 1];
          let lastOrder = lastLearning?.module?.order;
          let metadataPatched = false;

          if (lastLearning?.learningId) {
              const matchingModule = modules.find((m) => m.id === lastLearning.learningId);
              if (!lastLearning.module && matchingModule) {
                  lastLearning.module = matchingModule;
                  metadataPatched = true;
              }
              if (typeof lastOrder !== "number" && matchingModule && typeof matchingModule.order === "number") {
                  lastOrder = matchingModule.order;
              }
          }

          if (!lastLearning.availableAt) {
              lastLearning.availableAt =
                  lastLearning.assignedAt ||
                  lastLearning.createdAt ||
                  new Date().toISOString();
              metadataPatched = true;
          }

          if (metadataPatched) {
              await saveResponseProgress(userResponse);
          }

          if (typeof lastOrder !== "number") {
              console.warn("[Bot] Unable to determine module order for next assignment", lastLearning?.learningId);
              return;
          }
          
          const nextModule = modules.find(m => m.order > lastOrder);
          if (nextModule) {
              const now = new Date();
              const availableAt = new Date(now.getTime() + 18 * 60 * 60 * 1000).toISOString();
              
              const nextEntry = {
                  learningId: nextModule.id,
                  status: "available",
                  createdAt: now.toISOString(),
                  updatedAt: now.toISOString(),
                  availableAt: availableAt,
                  module: nextModule,
                  attempts: [],
                  quizAvailableAt: null,
                  usageAvailableAt: null,
              };
              
              userResponse.learnings.push(nextEntry);
              await saveResponseProgress(userResponse);
          }
      }
    } catch (error) {
      console.error("[Bot] Failed to queue next learning", error);
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
