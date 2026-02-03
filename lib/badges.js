import { containers } from "./cosmos.js";
import { calculateLevel } from "./xp";

export async function assignBadges(user) {
  const awardedBadges = [];
  const { resources: userBadges } = await containers.badges.items
    .query({
      query: "SELECT * FROM c WHERE c.userId = @userId",
      parameters: [{ name: "@userId", value: user.id }],
    })
    .fetchAll();

  const hasBadge = (badgeName) =>
    userBadges.some((b) => b.badgeName === badgeName);

  const level = calculateLevel(user.xp);

  if (level >= 2 && !hasBadge("bronze")) {
    const badge = {
      userId: user.id,
      badgeName: "bronze",
      awardedAt: new Date().toISOString(),
    };
    const { resource } = await containers.badges.items.create(badge);
    awardedBadges.push(resource);
  }
  if (level >= 4 && !hasBadge("silver")) {
    const badge = {
      userId: user.id,
      badgeName: "silver",
      awardedAt: new Date().toISOString(),
    };
    const { resource } = await containers.badges.items.create(badge);
    awardedBadges.push(resource);
  }
  if (level >= 6 && !hasBadge("gold")) {
    const badge = {
      userId: user.id,
      badgeName: "gold",
      awardedAt: new Date().toISOString(),
    };
    const { resource } = await containers.badges.items.create(badge);
    awardedBadges.push(resource);
  }

  return awardedBadges;
}
