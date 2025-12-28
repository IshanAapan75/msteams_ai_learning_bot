// import { containers } from "@/lib/cosmos";
import { containers } from "../../../../lib/cosmos";
import { addXp } from "../../../../lib/xp";
import { assignBadges } from "../../../../lib/badges";

export async function POST(req) {
  const { userId, questionId, answer } = await req.json();

  const { resource: question } =
    await containers.questions.item(questionId, questionId).read();

  const correct = question.correctAnswer === answer;
  const earnedXp = correct ? question.xp : 0;

  const { resource: user } =
    await containers.users.item(userId, userId).read();

  const xpResult = addXp(user.xp || 0, earnedXp);

  await containers.users.item(userId, userId).replace({
    ...user,
    ...xpResult,
  });

  const newBadges = await assignBadges({ ...user, ...xpResult });

  if (correct && user.teamId) {
    const { resource: team } = await containers.teams.item(user.teamId, user.teamId).read();
    await containers.teams.item(user.teamId, user.teamId).replace({
      ...team,
      score: (team.score || 0) + earnedXp,
    });
  }

  await containers.responses.items.create({
    userId,
    questionId,
    answer,
    correct,
    earnedXp,
    timestamp: new Date().toISOString(),
  });

  return Response.json({
    correct,
    earnedXp,
    totalXp: xpResult.xp,
    level: xpResult.level,
    newBadges,
  });
}
