export function calculateLevel(xp) {
  return Math.floor(xp / 100) + 1;
}

export function addXp(currentXp, earnedXp) {
  const totalXp = currentXp + earnedXp;
  return {
    xp: totalXp,
    level: calculateLevel(totalXp),
  };
}