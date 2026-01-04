require('dotenv').config({ path: './env/.env.dev' });
const { containers } = require('./lib/cosmos');

async function seed() {
  console.log('Seeding database...');

  // Seed teams
  const teams = [
    { id: 'Engineering', name: 'Engineering', score: 0 },
    { id: 'Management', name: 'Management', score: 0 },
  ];

  for (const team of teams) {
    await containers.teams.items.upsert(team);
  }
  console.log('Seeded teams');

  // Seed badges
  const badges = [
    { id: 'master', name: 'Master', description: 'Awarded for getting all answers correct in a quiz.' },
    { id: 'pro', name: 'Pro', description: 'Awarded for getting 3-4 answers correct in a quiz.' },
    { id: 'beginner', name: 'Beginner', description: 'Awarded for getting 1-2 answers correct in a quiz.' },
  ];

  for (const badge of badges) {
    await containers.badges.items.upsert(badge);
  }
  console.log('Seeded badges');

  // Seed ai_learning
  const learningModules = [
    {
      id: 'cl1',
      topic: 'Introduction to AI',
      description: 'Learn the basics of Artificial Intelligence.',
      details: 'This module covers the fundamental concepts of AI, including machine learning, neural networks, and natural language processing.',
      level: 'Beginner',
      status: 'not started',
      rewards: 5,
      quizzes: ['quiz1', 'quiz2'],
    },
    {
        id: 'cl2',
        topic: 'Advanced AI',
        description: 'Dive deep into advanced AI topics.',
        details: 'This module covers advanced concepts such as deep learning, reinforcement learning, and generative AI.',
        level: 'Advanced',
        status: 'not started',
        rewards: 10,
        quizzes: ['quiz3', 'quiz4'],
      },
  ];

  for (const module of learningModules) {
    await containers.ai_learning.items.upsert(module);
  }
  console.log('Seeded ai_learning');

  // Seed assessment questions
  const assessmentQuestions = [
    {
      id: 'q1',
      type: 'mcq',
      text: 'What is the most accurate description of how tools like ChatGPT or Copilot work?',
      options: [
        'They search the internet for correct answers',
        'They predict likely responses based on patterns in data',
        'They reason like humans',
        'They always return factual information',
      ],
      correctAnswerIndex: 1,
    },
    {
      id: 'q2',
      type: 'mcq',
      text: 'Which task is AI generally BEST suited for?',
      options: [
        'Making final business decisions',
        'Generating perfect, error-free content',
        'Drafting and summarizing information quickly',
        'Replacing human judgment entirely',
      ],
      correctAnswerIndex: 2,
    },
    {
      id: 'q3',
      type: 'mcq',
      text: 'Which statement about AI output is TRUE?',
      options: [
        'AI outputs are always accurate',
        'AI understands the meaning of what it writes',
        'AI may produce confident but incorrect information',
        'AI remembers past conversations across tools',
      ],
      correctAnswerIndex: 2,
    },
    {
      id: 'q4',
      type: 'mcq',
      text: 'Which prompt is MOST effective?',
      options: [
        '“Summarize”',
        '“Summarize this”',
        '“Summarize this meeting and extract 5 action items for the leadership team”',
        '“Tell me what happened”',
      ],
      correctAnswerIndex: 2,
    },
    {
      id: 'q5',
      type: 'mcq',
      text: 'If the AI output isn’t what you want, what should you do first?',
      options: [
        'Stop using AI',
        'Ask the same prompt again',
        'Refine the instructions or add context',
        'Assume the tool is broken',
      ],
      correctAnswerIndex: 2,
    },
    {
      id: 'q6',
      type: 'mcq',
      text: 'You need to prepare a client update quickly. What is the BEST use of AI?',
      options: [
        'Ask AI to send the email directly to the client',
        'Ask AI to draft the email, then review and edit it yourself',
        'Copy the AI output without reading it',
        'Avoid using AI for client communication',
      ],
      correctAnswerIndex: 1,
    },
    {
      id: 'q7',
      type: 'mcq',
      text: 'AI gives you an answer that “looks right” but feels off. What should you do?',
      options: [
        'Trust it anyway',
        'Ignore the feeling',
        'Verify key facts or cross-check with another source',
        'Assume AI is wrong and delete everything',
      ],
      correctAnswerIndex: 2,
    },
    {
      id: 'q8',
      type: 'mcq',
      text: 'Which information should generally NOT be entered into public AI tools?',
      options: [
        'Public marketing copy',
        'Generic meeting notes',
        'Customer personal data or confidential information',
        'Brainstorming ideas',
      ],
      correctAnswerIndex: 2,
    },
    {
      id: 'q9',
      type: 'self_assessment',
      text: 'How confident do you feel using AI tools in your daily work?',
      options: [
        { text: 'Not confident', value: 1, score: 2 },
        { text: 'Slightly confident', value: 2, score: 4 },
        { text: 'Moderately confident', value: 3, score: 6 },
        { text: 'Confident', value: 4, score: 8 },
        { text: 'Very confident', value: 5, score: 10 },
      ],
    },
    {
      id: 'q10',
      type: 'usage_frequency',
      text: 'How often do you currently use AI tools at work?',
      options: [
        { text: 'Never', value: 'Never', score: 0 },
        { text: 'Occasionally (once a month or less)', value: 'Monthly', score: 2 },
        { text: 'Sometimes (once a week)', value: 'Weekly', score: 5 },
        { text: 'Regularly (multiple times a week)', value: 'Multiple weekly', score: 8 },
        { text: 'Daily', value: 'Daily', score: 10 },
      ],
    },
  ];

  for (const question of assessmentQuestions) {
    await containers.assessmentquestion.items.upsert(question);
  }
  console.log('Seeded assessment questions');

  // Seed scoring configuration
  const scoringConfig = {
    id: 'scoring_config',
    sectionWeights: {
      'Knowledge & mental models': { weight: 30, questions: ['q1', 'q2', 'q3'] },
      'Prompting skills': { weight: 20, questions: ['q4', 'q5'] },
      'Applied judgment': { weight: 20, questions: ['q6', 'q7'] },
      'Safety awareness': { weight: 10, questions: ['q8'] },
      'Confidence': { weight: 10, questions: ['q9'] },
      'Usage frequency': { weight: 10, questions: ['q10'] },
    },
    fluencyLevels: [
      { range: [0, 20], label: 'AI Rookie' },
      { range: [21, 40], label: 'AI Learner' },
      { range: [41, 60], label: 'AI Explorer' },
      { range: [61, 75], label: 'AI Practitioner' },
      { range: [76, 90], label: 'AI Expert' },
      { range: [91, 100], label: 'AI Champion' },
    ],
  };
  await containers.assessmentquestion.items.upsert(scoringConfig);
  console.log('Seeded assessment scoring configuration');

  console.log('Database seeding complete.');
}

seed().catch(console.error);