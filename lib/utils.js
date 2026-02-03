const MINUTES_TO_MS = 60 * 1000;

function computeStartTimestamp(delayMinutes) {
  const minutes = Number.isFinite(Number(delayMinutes)) ? Number(delayMinutes) : 3;
  const ms = Math.max(0, minutes) * MINUTES_TO_MS;
  return new Date(Date.now() + ms).toISOString();
}

module.exports.computeStartTimestamp = computeStartTimestamp;
