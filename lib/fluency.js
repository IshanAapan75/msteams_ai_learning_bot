
/**
 * Calculates the individual AI Fluency Score based on user activity.
 * Formula: (daysUsedAI * 3) + (avgConfidence * 5) + (streak * 1) + (microActionsCompleted * 2) + (correctness * 15)
 * Max Score: 100
 * 
 * @param {Object} params
 * @param {Array} params.recentLogs - Array of user usage logs (last 30 days recommended)
 * @param {number} params.streak - Current user streak
 * @param {number} params.microActionsCompleted - Total count of completed micro-actions
 * @param {number} params.assessmentCorrectness - Fraction (0.0 to 1.0) of correct assessment answers
 * @returns {number} fluencyScore (0-100)
 */
export function calculateFluencyScore({ recentLogs, streak, microActionsCompleted, assessmentCorrectness }) {
    // 1. Days Used AI (Unique days in logs)
    const uniqueDays = new Set(recentLogs.map(l => new Date(l.timestamp).toDateString()));
    const daysUsedAI = uniqueDays.size;

    // 2. Average Confidence (1-5 scale)
    // If log has no confidence, treat as 0 or ignore? PDF implies (sum / count).
    // We will filter for logs that actually have confidence.
    const logsWithConfidence = recentLogs.filter(l => l.responses && l.responses.confidence);
    const avgConfidence = logsWithConfidence.length > 0
        ? logsWithConfidence.reduce((sum, l) => sum + (parseInt(l.responses.confidence) || 0), 0) / logsWithConfidence.length
        : 0;

    // 3. Correctness (0.0 - 1.0) -> * 15
    const correctnessScore = (assessmentCorrectness || 0) * 15;

    // Formula
    // (daysUsedAI * 3) + (avgConfidence * 5) + (streak * 1) + (microActionsCompleted * 2) + (correctness * 15)
    let score = 
        (daysUsedAI * 3) + 
        (avgConfidence * 5) + 
        (streak * 1) + 
        (microActionsCompleted * 2) + 
        correctnessScore;

    // Cap at 100
    if (score > 100) score = 100;
    
    return Math.round(score);
}

/**
 * Calculates the Team AI Momentum Score.
 * Formula: (avgFluency * 0.4) + (growth * 2) + (%ActiveUsers * 0.1) + (%Streaks * 0.07) + (sentimentTrend * 3)
 * Range: 0-100
 * 
 * @param {Object} stats
 * @param {number} stats.avgFluency - Average Fluency Score across all users
 * @param {number} stats.fluencyGrowth - Week-over-week growth in fluency (absolute or percentage points)
 * @param {number} stats.percentActiveUsers - % of users active in last 7 days (0-100)
 * @param {number} stats.percentWithStreaks - % of users with streak > 0 (0-100)
 * @param {number} stats.sentimentTrend - Average sentiment score (1-5)
 * @returns {number} momentumScore (0-100)
 */
export function calculateMomentumScore({ avgFluency, fluencyGrowth, percentActiveUsers, percentWithStreaks, sentimentTrend }) {
    // Growth capped at 20 for the formula
    const growth = Math.max(0, Math.min(20, fluencyGrowth || 0));

    let score = 
        (avgFluency * 0.4) + 
        (growth * 2) + 
        (percentActiveUsers * 0.1) + 
        (percentWithStreaks * 0.07) + 
        (sentimentTrend * 3);

    if (score > 100) score = 100;
    if (score < 0) score = 0;

    return Math.round(score);
}
