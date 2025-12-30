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

  console.log('Database seeding complete.');
}

seed().catch(console.error);