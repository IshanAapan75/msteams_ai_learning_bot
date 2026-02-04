const LEVEL_UP_BASE = 100;
const LEVEL_UP_MULTIPLIER = 1.5;

function getXpForLevel(level) {
  if (level <= 1) return 0;
  return Math.floor(
    LEVEL_UP_BASE * (Math.pow(LEVEL_UP_MULTIPLIER, level - 1) - 1)
  );
}

function calculateLevel(xp) {
  let level = 1;
  while (xp >= getXpForLevel(level + 1)) {
    level++;
  }
  return level;
}

function addXp(currentXp, earnedXp) {
  const totalXp = currentXp + earnedXp;
  return {
    xp: totalXp,
    level: calculateLevel(totalXp),
  };
}

module.exports = {
    getXpForLevel,
    calculateLevel,
    addXp
};
