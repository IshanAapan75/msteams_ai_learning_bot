export function assignBadges(user) {
  const badges = user.badges || [];

  if (user.xp >= 100 && !badges.includes("bronze")) badges.push("bronze");
  if (user.xp >= 300 && !badges.includes("silver")) badges.push("silver");
  if (user.xp >= 600 && !badges.includes("gold")) badges.push("gold");

  return badges;
}