const { TeamsActivityHandler, CardFactory, MessageFactory, ActionTypes, TurnContext } = require("botbuilder");
const { TeamsInfo } = require("botbuilder");
const { upsertUserProfile } = require("./lib/users");
const { containers } = require("./lib/cosmos");
const { syncLearningAssignment, recordSurveyAndAssignNext, COOLDOWN_MS, fetchLearningCatalog, assignNextLearning } = require("./lib/learningPlan.js");
const { fetchResponseProgress, saveResponseProgress, updateLearningEntry } = require("./lib/learningProgress.js");
const { awardXpAction } = require("./lib/rewards.js");
const appUrl = process.env.APP_URL || "http://localhost:3000";

const httpFetch = (...args) =>
  typeof fetch === "function"
    ? fetch(...args)
    : import("node-fetch").then(({ default: fetchImpl }) => fetchImpl(...args));

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
const LEARNING_START_DELAY_MINUTES = 0;
const NEXT_LEARNING_DELAY_MS = COOLDOWN_MS;
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
  const submitData = {
    action: "submit_survey",
  };
  if (learningId) {
    submitData.learningId = learningId;
  }
  return CardFactory.adaptiveCard({
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    type: "AdaptiveCard",
    body: [
      {
        type: "TextBlock",
        text: "👏 Awesome! Tell us about your AI Usage",
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
        data: submitData,
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

async function getGlobalMenuActions(userId, assessmentCompleted, learningStatus) {
  const actions = [];
  
  let showRetake = false;
  let showMicroAction = false;
  try {
      const userResponse = await fetchResponseProgress(userId);
      // Check ALL learnings for pending micro-actions or retakes, prioritizing the most recent
      const reversedLearnings = (userResponse.learnings || []).slice().reverse();
      
      const currentLearning = reversedLearnings.find(l => l.status === 'completed' || l.quizPassedAt);
      
      if (currentLearning) {
          const attemptCount = currentLearning.attempts?.length || 0;
          const hasPassed = Boolean(currentLearning.quizPassedAt);

          if (!hasPassed && attemptCount === 1) {
              showRetake = true;
          } else if ((hasPassed || attemptCount >= 2) && !currentLearning.microActionCompleted) {
              showMicroAction = true;
          }
      }
  } catch (err) {}

  if (!assessmentCompleted) {
    actions.push({ title: "🧠 Start Assessment", action: "trigger_assessment", text: "start assessment" });
  } else {
    // Show Micro Action if it's the current next step
    if (showMicroAction) {
        actions.push({ title: "⚡ Micro Action", action: "trigger_micro_action", text: "micro action" });
    } else if (showRetake) {
        actions.push({ title: "🔄 Retake Quiz", action: "trigger_quiz", text: "start quiz" });
    } else if (learningStatus === "available") {
        actions.push({ title: "📘 View Learning", action: "trigger_learning", text: "view learning" });
    } else if (learningStatus === "completed") {
        actions.push({ title: "🎯 Start Quiz", action: "trigger_quiz", text: "start quiz" });
    }

    actions.push({ title: "📝 Log AI Usage", action: "trigger_logusage", text: "log ai usage" });
    actions.push({ title: "📊 My Usage", action: "trigger_myusage", text: "my usage" });
    actions.push({ title: "📈 Fluency Score", action: "trigger_fluency_score", text: "fluency score" });
  }
  return actions;
}

async function buildMainMenuCard(userId, assessmentCompleted = false, learningStatus = "available") {
  const rawActions = await getGlobalMenuActions(userId, assessmentCompleted, learningStatus);
  
  // Map to Adaptive Card Action.Submit
  const actions = rawActions.map(a => ({
      type: "Action.Submit",
      title: a.title,
      data: { action: a.action, msteams: { type: "messageBack", text: a.text } }
  }));

  return CardFactory.adaptiveCard({
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    type: "AdaptiveCard",
    body: [],
    actions
  });
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
      } else {
        // Just update activity timestamp and reference
        await upsertUserProfile({
            id: userId,
            lastActivityAt: new Date().toISOString(),
            conversationReference: TurnContext.getConversationReference(context.activity)
        });
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

      // Check for current assignment
      const assignment = await fetchAssignment(userId);

      if (assignment?.assignment) {
        const active = assignment.assignment;
        console.log(`[Bot] Assignment state: ID=${active.learningId}, Status=${active.status}`);
        state.microLearningId = active.learningId || state.microLearningId;
        state.microLearningStatus = active.status || state.microLearningStatus;
        state.microLearningQuizzes = active.module?.quizzes || state.microLearningQuizzes;
      }

      // Map button actions and basic greetings first
      const action = context.activity.value?.action;
      
      if (text === "hi" || text === "hello") {
        const learningStatus = assignment?.assignment?.status;
        if (!state.assessmentCompleted) {
          await this.replyWithMenu(context, userId, "👋 Welcome! Please complete your AI Fluency Assessment first to unlock your personalized learning plan.");
          return;
        }

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

        await this.replyWithMenu(context, userId, "How can I help you today?");
        return;
      }

      if (action === "trigger_assessment" || text === "start assessment") {
          await this.handleAssessmentCommand(context, state, userId);
          await this.conversationState.saveChanges(context);
          return;
      }
      if (action === "trigger_learning" || text === "view learning") {
          await this.handleLearningCommand(context, userId, assignment);
          return;
      }
      if (action === "trigger_quiz" || text === "start quiz") {
          await this.handleStartQuizCommand(context, state, userId, assignment);
          await this.conversationState.saveChanges(context);
          return;
      }
      if (action === "trigger_logusage" || text === "log ai usage") {
          const surveyCard = buildSurveyCard();
          await context.sendActivity({ attachments: [surveyCard] });
          return;
      }
      if (action === "trigger_myusage" || text === "my usage") {
          await this.handleMyUsageCommand(context, userId);
          return;
      }
      if (action === "trigger_fluency_score" || text === "fluency score") {
          await this.handleFluencyScoreCommand(context, userId);
          return;
      }
      if (action === "trigger_micro_action" || text === "micro action") {
          await this.handleMicroActionTrigger(context, userId);
          return;
      }
      if (action === "submit_micro_action") {
          await this.handleMicroActionSubmit(context, userId, context.activity.value);
          return;
      }

      // Automatically trigger assessment for new users (moved after explicit button checks)
      if (!state.assessmentCompleted && text !== "/assessment" && text !== "hi" && context.activity.value?.action !== "submit_full_assessment") {
          console.log(`[Bot] User ${userId} has not completed assessment. Triggering diagnostic.`);
          await this.handleAssessmentCommand(context, state, userId);
          await this.conversationState.saveChanges(context);
          return;
      }

      if (text === "/learning") {
        await this.handleLearningCommand(context, userId, assignment);
        return;
      }

      if (text === "/logusage") {
        const surveyCard = buildSurveyCard();
        await context.sendActivity({ attachments: [surveyCard] });
        return;
      }

      if (text === "/myusage") {
        await this.handleMyUsageCommand(context, userId);
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

      if (assignment?.assignment?.canStart === false) {
        await this.replyWithMenu(context, userId, "You're doing great! Next module will unlock soon. I'll remind you when it's ready.");
      } else {
        await this.replyWithMenu(context, userId, "How can I help you today?");
      }
    });

    this.onMembersAdded(async (context, next) => {
      for (const member of context.activity.membersAdded) {
        if (member.id !== context.activity.recipient.id) {
          await this.ensureUserExists(context, member.id, member.name);
        }
      }
      await next();
    });
  }

  async sendMainMenuSuggestedActions(context, userId, assessmentCompleted = false, learningStatus = "available", text = "How can I help you today?") {
    const rawActions = await getGlobalMenuActions(userId, assessmentCompleted, learningStatus);
    const actions = rawActions.map(a => ({
        type: ActionTypes.MessageBack,
        title: a.title,
        text: a.text,
        displayText: a.title,
        value: { action: a.action }
    }));
    const message = MessageFactory.suggestedActions(actions, text);
    await context.sendActivity(message);
  }

  async replyWithMenu(context, userId, text) {
      const assignment = await fetchAssignment(userId);
      const { resources: assessmentResponses } = await containers.assessmentresponse.items
            .query({
              query: "SELECT * FROM c WHERE c.userId = @userId",
              parameters: [{ name: "@userId", value: userId }],
            })
            .fetchAll();
      const assessmentCompleted = assessmentResponses.length > 0;
      const learningStatus = assignment?.assignment?.status;
      
      // Send the text feedback only if provided
      if (text && text.trim() !== "") {
          await context.sendActivity(text);
      }
      
      // Attach the menu buttons card
      const menuCard = await buildMainMenuCard(userId, assessmentCompleted, learningStatus);
      await context.sendActivity({ attachments: [menuCard] });
  }

  async handleStartQuizCommand(context, state, userId, assignment) {
    if (!assignment) {
      await this.replyWithMenu(context, userId, "I couldn't find a learning module ready for a quiz. Please check 'View Learning' to see your progress.");
      return;
    }

    const activeLearning = assignment?.assignment;

    if (activeLearning && activeLearning.status !== "completed") {
      await this.replyWithMenu(context, userId, "Please finish the current learning module before starting the quiz. Click 'View Learning' to view it.");
      return;
    }

    const candidateLearningId = activeLearning?.learningId || state.microLearningId;
    const candidateStatus = activeLearning?.status || state.microLearningStatus;

    let learningEntry = null;
    if (candidateLearningId) {
      learningEntry = await loadLearningEntry(userId, candidateLearningId);
    }

    if (!learningEntry) {
      await this.replyWithMenu(context, userId, "I couldn't find a completed learning module ready for a quiz yet. Please complete a module first.");
      return;
    }

    const effectiveStatus = (candidateStatus || learningEntry.status || "").toLowerCase();
    if (effectiveStatus !== "completed") {
      await this.replyWithMenu(context, userId, "Please finish the current learning module before starting the quiz. Click 'View Learning' to view it.");
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
      await this.replyWithMenu(context, userId, errorBody.error || "I couldn't find a quiz right now.");
      return;
    }

    const data = await res.json();
    if (!data.quizzes?.length) {
      await this.replyWithMenu(context, userId, "No quizzes are ready yet—please check back later.");
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
  }

  async handleLearningCommand(context, userId, assignment) {
    console.log(`[Bot] learning command received from user: ${userId}`);
    if (!assignment?.assignment) {
      console.log(`[Bot] No active assignment found for user: ${userId}`);
      await this.replyWithMenu(context, userId, "I couldn't find any learning modules for you yet.");
      return;
    }

    console.log(`[Bot] Rendering learning card for: ${assignment.assignment.learningId}`);
    const startsAt = assignment.assignment.availableAt;
    const delayMessage = buildDelayMessage("Learning", startsAt);
    if (delayMessage) {
      await this.replyWithMenu(context, userId, delayMessage);
    }

    const card = buildLearningSummaryCard(assignment.assignment);
    if (card) {
      await context.sendActivity({ attachments: [card] });
    }
  }

  async handleMyUsageCommand(context, userId) {
    try {
      const { resources: userUsages } = await containers.userusage.items
        .query({
          query: "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.timestamp DESC",
          parameters: [{ name: "@userId", value: userId }],
        })
        .fetchAll();

      if (!userUsages || userUsages.length === 0) {
        await this.replyWithMenu(context, userId, "You haven't logged any AI usage yet. Click 'Log AI Usage' to get started!");
        return;
      }

      const body = [
        {
          type: "TextBlock",
          text: "📊 Your AI Usage History",
          weight: "bolder",
          size: "large",
          color: "accent"
        }
      ];

      // Limit to last 5 entries to keep card readable, or send multiple
      userUsages.slice(0, 5).forEach((usage, index) => {
        const dateStr = new Date(usage.timestamp).toLocaleDateString() + ' ' + new Date(usage.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        body.push({
          type: "Container",
          spacing: "medium",
          separator: index > 0,
          items: [
            {
              type: "TextBlock",
              text: `Entry: ${usage.responses.actionType || "AI Interaction"}`,
              weight: "bolder",
              wrap: true
            },
            {
              type: "FactSet",
              facts: [
                { title: "Date", value: dateStr },
                { title: "Time Saved", value: usage.responses.timeSaved || "N/A" },
                { title: "Confidence", value: usage.responses.confidence || "N/A" }
              ]
            }
          ]
        });

        if (usage.responses.notes) {
          body[body.length-1].items.push({
            type: "TextBlock",
            text: `_${usage.responses.notes}_`,
            isSubtle: true,
            wrap: true,
            size: "small"
          });
        }
      });

      const historyCard = CardFactory.adaptiveCard({
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
        version: "1.4",
        type: "AdaptiveCard",
        body
      });

      await context.sendActivity({ attachments: [historyCard] });
      await this.replyWithMenu(context, userId, userUsages.length > 5 ? "Showing your 5 most recent entries." : "");

    } catch (error) {
      console.error("[Bot] Failed to fetch user usages", error);
      await this.replyWithMenu(context, userId, "Sorry, I couldn't retrieve your AI usages right now.");
    }
  }

  async handleFluencyScoreCommand(context, userId) {
      try {
          const { resource: rewardRecord } = await containers.rewards.item(userId, userId).read();
          
          if (!rewardRecord) {
              await this.replyWithMenu(context, userId, "I couldn't find your fluency score yet. Have you completed the initial assessment?");
              return;
          }

          const score = rewardRecord.fluency || 0;
          const tier = rewardRecord.tier || "AI Rookie";
          const components = rewardRecord.fluencyComponents || {};

          const scoreCard = CardFactory.adaptiveCard({
              $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
              version: "1.4",
              type: "AdaptiveCard",
              body: [
                  { type: "TextBlock", text: "📈 Your AI Fluency Score", weight: "bolder", size: "large", color: "accent" },
                  { 
                      type: "ColumnSet",
                      spacing: "medium",
                      columns: [
                          {
                              type: "Column",
                              width: "stretch",
                              items: [
                                  { type: "TextBlock", text: `${score}`, size: "extraLarge", weight: "bolder", color: "good", horizontalAlignment: "center" },
                                  { type: "TextBlock", text: "Current Score", isSubtle: true, horizontalAlignment: "center", spacing: "none" }
                              ]
                          },
                          {
                              type: "Column",
                              width: "stretch",
                              items: [
                                  { type: "TextBlock", text: tier, size: "large", weight: "bolder", wrap: true, horizontalAlignment: "center" },
                                  { type: "TextBlock", text: "Current Tier", isSubtle: true, horizontalAlignment: "center", spacing: "none" }
                              ]
                          }
                      ]
                  },
                  {
                      type: "FactSet",
                      spacing: "large",
                      separator: true,
                      facts: [
                          { title: "Assessments", value: `${components.assessments || 0} pts` },
                          { title: "Daily Usage", value: `${components.usage || 0} pts` },
                          { title: "Skill Quality", value: `${components.quality || 0} pts` },
                          { title: "Confidence", value: `${components.confidence || 0} pts` },
                          { title: "Consistency", value: `${components.consistency || 0} pts` }
                      ]
                  }
              ]
          });

          await context.sendActivity({ attachments: [scoreCard] });
          await this.replyWithMenu(context, userId, "");

      } catch (error) {
          console.error("[Bot] Failed to fetch fluency score", error);
          await this.replyWithMenu(context, userId, "Sorry, I ran into an error while checking your score.");
      }
  }

  async handleMicroActionTrigger(context, userId) {
      try {
          const userResponse = await fetchResponseProgress(userId);
          // Search from newest to oldest to find the active pending micro-action
          const reversedLearnings = (userResponse.learnings || []).slice().reverse();
          const currentLearning = reversedLearnings.find(l => (l.status === 'completed' || l.quizPassedAt) && !l.microActionCompleted);
          
          if (!currentLearning || !currentLearning.module) {
              await this.replyWithMenu(context, userId, "No pending Micro Action found.");
              return;
          }

          const module = currentLearning.module;
          const card = CardFactory.adaptiveCard({
              $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
              version: "1.4",
              type: "AdaptiveCard",
              body: [
                  { type: "TextBlock", text: "⚡ Micro Action", weight: "bolder", size: "large", color: "accent" },
                  { type: "TextBlock", text: "Put your learning into practice with this quick task:", wrap: true, spacing: "medium" },
                  { type: "TextBlock", text: module.microAction || "Try applying today's concept in your next AI interaction.", weight: "bolder", wrap: true, spacing: "small" },
                  { type: "TextBlock", text: "Example Prompt:", wrap: true, spacing: "medium", isSubtle: true },
                  { type: "TextBlock", text: `_"${module.examplePrompt || "N/A"}"_`, wrap: true, spacing: "small", fontType: "monospace" },
                  { type: "TextBlock", text: "Did you try this Micro Action?", wrap: true, spacing: "large" }
              ],
              actions: [
                  { type: "Action.Submit", title: "Yes ✅", data: { action: "submit_micro_action", choice: "yes", learningId: module.id } },
                  { type: "Action.Submit", title: "No ❌", data: { action: "submit_micro_action", choice: "no", learningId: module.id } }
              ]
          });

          await context.sendActivity({ attachments: [card] });
      } catch (error) {
          console.error("[Bot] Micro Action trigger failed", error);
          await this.replyWithMenu(context, userId, "Sorry, I couldn't load the Micro Action right now.");
      }
  }

  async handleMicroActionSubmit(context, userId, value) {
      const { choice, learningId } = value;
      try {
          if (choice === "yes") {
              await awardXpAction({
                  userId,
                  actionType: "micro-action",
                  metadata: { details: { learningId, awarded: "bonus_xp" } }
              });
              await context.sendActivity("🌟 **Awesome!** You've earned **10 bonus XP** for taking action.");
          }

          // Mark as complete in user progress
          await updateLearningEntry(userId, learningId, { microActionCompleted: true });

          // Assign next module
          const userResponse = await fetchResponseProgress(userId);
          const finishedModule = await loadModuleDetails(learningId);
          const assignedNext = await assignNextLearning(userId, learningId, userResponse);
          await saveResponseProgress(userResponse);

          let message = "Thanks for the feedback!";
          
          if (assignedNext) {
              // Tier Check
              const nextModule = assignedNext.module;
              if (finishedModule && nextModule && nextModule.tier && finishedModule.tier !== nextModule.tier) {
                  message += `\n\n🎖️ **Congratulations!** You've been promoted to **${nextModule.tier}**!`;
              }
              message += `\n\n🎉 Good news! Your next learning module "**${nextModule.title}**" is now UNLOCKED and ready for you.`;
          }

          await this.replyWithMenu(context, userId, message);
      } catch (error) {
          console.error("[Bot] Micro Action submission failed", error);
          await this.replyWithMenu(context, userId, "I hit an error while recording your action. Let's keep going!");
      }
  }

  async assignFirstLearningModule(context, userId) {
    if (!userId) return false;

    try {
      let userResponse = await fetchResponseProgress(userId);
      const learnings = userResponse.learnings || [];

      // 1. Find Day 1 and check if it's fully complete (Status + Quiz)
      const day1Entry = learnings.find(l => l.learningId === 'micro-learning-day-1');
      const isDay1FullyDone = day1Entry && day1Entry.status === 'completed' && day1Entry.quizPassedAt;

      if (isDay1FullyDone) {
          // Prerequisite met. User can move forward with whatever else they have.
          return false;
      }

      // 2. If Day 1 is NOT fully done, but they have other modules (like Day 16), we reset.
      const hasOtherModules = learnings.some(l => l.learningId !== 'micro-learning-day-1');

      if (hasOtherModules) {
          console.log(`[Bot] Prerequisite fail: Day 1 not done but other modules found. Resetting to Day 1.`);
          // Keep Day 1 if it exists (so they don't lose reading progress), but remove everything else.
          userResponse.learnings = day1Entry ? [day1Entry] : [];
          await saveResponseProgress(userResponse);
          
          if (day1Entry) return false; // Day 1 is now the only one, no need to "assign" it again.
      }

      if (userResponse.learnings && userResponse.learnings.length > 0) {
        return false;
      }

      // 3. Strictly assign Day 1
      const { resource: firstModule } = await containers.ai_learning.item('micro-learning-day-1', 'micro-learning-day-1').read();

      if (!firstModule) {
        console.warn("[Bot] micro-learning-day-1 not found in catalog.");
        return false;
      }

      const nowIso = new Date().toISOString();
      
      userResponse.learnings = [
        {
          learningId: firstModule.id,
          status: "available",
          createdAt: nowIso,
          updatedAt: nowIso,
          availableAt: nowIso, // Immediate (0 delay)
          module: firstModule,
          attempts: [],
          quizAvailableAt: null,
          usageAvailableAt: null,
        },
      ];
      userResponse.updatedAt = nowIso;

      await saveResponseProgress(userResponse);
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

        await context.sendActivity("You have already completed the AI Fluency Assessment. Here are your results:");
        const resultsCard = buildAssessmentResultsCard(latestResponse.fluencyScore, levelLabel);
        await context.sendActivity({ attachments: [resultsCard] });
        await this.replyWithMenu(context, userId, "How else can I help you?");
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
      await this.replyWithMenu(context, userId, "Sorry, I ran into an error while trying to start the assessment. How else can I help?");
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

      const assigned = await this.assignFirstLearningModule(context, userId);
      if (assigned) {
        await this.replyWithMenu(context, userId, "🎉 **Assessment Complete!**\n\n📘 Let's get started! Click 'View Learning' to open your first module.");
      } else {
        const assignment = await fetchAssignment(userId);
        if (assignment?.assignment) {
          await this.replyWithMenu(context, userId, "📘 You're all set. Click 'View Learning' to continue with your personalized module.");
        } else {
          await this.replyWithMenu(context, userId, "Your assessment is complete! How else can I help?");
        }
      }

    } catch (error) {
      console.error("[Bot] Failed to handle full assessment submission", error);
      await this.replyWithMenu(context, userId, "Sorry, I ran into an error while submitting your assessment. Please try again or use the menu below.");
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

      await this.replyWithMenu(context, userId, "✅ **Learning marked complete!**\n\nYou can start the quiz right away by clicking 'Start Quiz'.");
    } catch (error) {
      console.error("[Bot] Failed to mark learning complete", error);
      await this.replyWithMenu(context, userId, "Sorry, I couldn't update your learning status. Try again later or explore other options.");
    }
  }

  async submitSurvey(context, state, userId, payload) {
    const { learningId } = payload;

    const confidenceValue = payload.survey_confidence ?? payload.confidence;
    const sentimentValue = payload.survey_sentiment ?? payload.sentiment;

    if (!payload.actionType || !payload.timeSaved || !confidenceValue || !sentimentValue) {
        await context.sendActivity("Please answer all required questions before submitting.");
        return;
    }

    try {
        const submittedAt = new Date();
        const submittedAtIso = submittedAt.toISOString();

        // Create the new usage document
        const usageDoc = {
            id: `${userId}-${Date.now()}`,
            userId: userId,
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

        if (learningId) {
          usageDoc.learningId = learningId;
        }

        // Save to the new container
        await containers.userusage.items.create(usageDoc);
        
        // Update user profile with last usage timestamp
        await upsertUserProfile({
            id: userId,
            lastUsageLogAt: submittedAtIso,
            lastActivityAt: submittedAtIso
        });
        
        await this.replyWithMenu(context, userId, "🙌 Logged! Your AI Usage has been recorded.");

    } catch (error) {
        console.error("[Bot] Failed to submit survey", error);
        await this.replyWithMenu(context, userId, "Something went wrong while saving that. Please try again.");
    }
  }

  async handleQuizAnswer(context, state, userId, rawText) {
    const answer = context.activity.value?.answer || rawText;
    const question = state.currentQuiz.questions[state.questionIndex];

    if (!question) {
      state.inQuiz = false;
      await this.replyWithMenu(context, userId, "I lost track of the question set. Let's start over soon.");
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
    await this.moveToNextQuiz(context, state, userId);

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
        const userResponse = await fetchResponseProgress(userId);
        const learning = userResponse?.learnings?.find((entry) => entry.learningId === state.microLearningId);
        
        // The API already added the attempt, so we just count the total now
        const attemptCount = learning?.attempts?.length || 1;
        const isFirstFail = result.result !== "passed" && attemptCount === 1;
        const isSecondFail = result.result !== "passed" && attemptCount >= 2;

        // Build feedback
        let feedback = `📊 **Quiz Summary**\n`;
        feedback += `Score: ${result.score.correct}/${result.score.total}\n\n`;
        
        if (result.result === "passed") {
            feedback += "✅ **Well done! You've passed the quiz.**\n\n";
            // Show review for passed quiz
            if (result.responses) {
                feedback += "🔍 **Question Review:**\n";
                result.responses.forEach((resp, idx) => {
                    feedback += `${idx + 1}. ✅ CORRECT: *${resp.answer}*\n`;
                });
            }
        } else if (isFirstFail) {
            feedback += "❌ **You didn't pass this time.** You have one more attempt to get a better score!\n\n";
            // Do NOT show answers on first fail
        } else if (isSecondFail) {
            feedback += "❌ **You didn't pass this attempt either.** To help you learn, here are the correct choices for the questions you missed. We'll move you forward to the next step now so you can keep building your skills!\n\n";
            if (result.responses && Array.isArray(result.responses)) {
                result.responses.forEach((resp, idx) => {
                    const isCorrect = Boolean(resp.correct);
                    const statusEmoji = isCorrect ? "✅" : "❌";
                    const statusText = isCorrect ? "CORRECT" : "INCORRECT";
                    
                    feedback += `${idx + 1}. ${statusEmoji} **${statusText}**\n`;
                    feedback += `   Your answer: *${resp.answer || "No answer"}*\n`;
                    
                    if (!isCorrect) {
                        feedback += `   Correct choice: **${resp.correctAnswer || "N/A"}**\n`;
                    }
                    feedback += "\n";
                });
            }
        }

        if (learning && result.result === "passed") {
          learning.quizPassedAt = new Date().toISOString();
          learning.status = "completed"; // Force completion state
          await saveResponseProgress(userResponse);
        }

        context.turnState.set("quiz_result", result.result);
        context.turnState.set("quiz_attempt_count", attemptCount);
        context.turnState.set("quiz_feedback", feedback);
      }
    } catch (error) {
      console.error("[Bot] Error submitting quiz attempt", error);
      await this.replyWithMenu(context, userId, "I hit an error while logging your answers. Please try again later.");
    }

    state.currentResponses = [];
  }

  async moveToNextQuiz(context, state, userId) {
    const quizResult = context.turnState.get("quiz_result");
    const attemptCount = context.turnState.get("quiz_attempt_count");
    const feedback = context.turnState.get("quiz_feedback") || "";

    // BLOCK PROGRESSION on 1st Fail
    if (quizResult !== "passed" && attemptCount === 1) {
        state.inQuiz = false;
        state.currentQuiz = null;
        state.allQuizzes = [];
        state.questionIndex = 0;
        state.currentResponses = [];
        
        await this.replyWithMenu(context, userId, feedback);
        return;
    }

    state.currentQuizIndex = (state.currentQuizIndex || 0) + 1;

    if (state.currentQuizIndex < state.allQuizzes.length) {
      state.currentQuiz = state.allQuizzes[state.currentQuizIndex];
      state.questionIndex = 0;
      state.currentResponses = [];
      await this.replyWithMenu(context, userId, `${feedback}\n\nNext quiz: **${state.currentQuiz.title}**. Let's keep going!`);
      await this.sendQuestion(context, state);
      return;
    }

    state.inQuiz = false;
    state.currentQuiz = null;
    state.allQuizzes = [];
    state.questionIndex = 0;
    state.currentResponses = [];
    
    const finishedModule = await loadModuleDetails(state.microLearningId);
    const assignment = await fetchAssignment(userId);
    const nextModule = assignment?.assignment?.module;
    const nextTitle = nextModule?.title || "Next Module";
    
    let completionMessage = feedback;

    // ONLY show progression if passed or 2nd fail
    if (quizResult === "passed" || attemptCount >= 2) {
        completionMessage += `\n\n🎉 All quizzes completed!`;
    }

    await this.replyWithMenu(context, userId, completionMessage);
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
      lastActivityAt: new Date().toISOString(),
      conversationReference: context.activity ? TurnContext.getConversationReference(context.activity) : null,
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
        lastActivityAt: new Date().toISOString(),
        conversationReference: TurnContext.getConversationReference(context.activity),
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
    if (!userId) {
      return;
    }
    try {
      const details = {
        actionType: payload?.actionType || null,
        timeSaved: payload?.timeSaved || null,
      };
      if (learningId) {
        details.learningId = learningId;
      }
      await awardXpAction({
        userId,
        actionType: "ai-usage",
        metadata: {
          details,
        },
      });
    } catch (error) {
      console.error("[Bot] Failed to award usage XP", error);
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
