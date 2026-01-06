import { containers } from "../../../../lib/cosmos";
import { NextResponse } from "next/server";
import { calculateMomentumScore } from "../../../../lib/fluency";

export const dynamic = 'force-dynamic';

function getDownline(managerId, allUsers) {
    if (!managerId) return allUsers; // If no manager specified, return everyone (Org View)

    let downline = [];
    let queue = [managerId];
    const visited = new Set([managerId]);

    // Find user object for the manager themselves and include them? 
    // Usually reporting data excludes the manager or includes them. 
    // Let's include the downline ONLY as per "reporting to me".
    // Actually, usually a team score includes the manager too if they are part of the team.
    // For hierarchy, let's strictly find reports.
    
    while (queue.length > 0) {
        const currentId = queue.shift();
        // Find direct reports
        const reports = allUsers.filter(u => u.managerId === currentId);
        
        for (const report of reports) {
            if (!visited.has(report.id)) {
                visited.add(report.id);
                downline.push(report);
                queue.push(report.id);
            }
        }
    }
    return downline;
}

function calculateGroupStats(groupUsers, groupLogs, totalGroupSize) {
    if (groupUsers.length === 0) return null;

    // Avg Fluency
    const totalFluency = groupUsers.reduce((sum, u) => sum + (u.fluencyScore || 0), 0);
    const avgFluency = Math.round(totalFluency / groupUsers.length);

    // % With Streaks
    const usersWithStreaks = groupUsers.filter(u => (u.streak || 0) > 0).length;
    const percentWithStreaks = Math.round((usersWithStreaks / groupUsers.length) * 100);

    // Filter logs for this group
    const groupUserIds = new Set(groupUsers.map(u => u.id));
    const relevantLogs = groupLogs.filter(l => groupUserIds.has(l.userId));

    // % Active Users (7 Days)
    const activeUserIds = new Set(relevantLogs.map(l => l.userId));
    // Use groupUsers.length as denominator (or totalGroupSize if provided)
    const percentActiveUsers = Math.round((activeUserIds.size / groupUsers.length) * 100);

    // Sentiment
    const logsWithSentiment = relevantLogs.filter(l => l.responses && l.responses.sentiment);
    const totalSentiment = logsWithSentiment.reduce((sum, l) => sum + (parseInt(l.responses.sentiment) || 0), 0);
    const sentimentTrend = logsWithSentiment.length > 0 
        ? parseFloat((totalSentiment / logsWithSentiment.length).toFixed(1)) 
        : 0;

    // Growth (MVP placeholder)
    const fluencyGrowth = 0;

    const momentumScore = calculateMomentumScore({
        avgFluency,
        fluencyGrowth,
        percentActiveUsers,
        percentWithStreaks,
        sentimentTrend
    });

    return {
        count: groupUsers.length,
        momentumScore,
        avgFluency,
        percentActiveUsers,
        avgSentiment: sentimentTrend,
        activeUserCount: activeUserIds.size
    };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const managerId = searchParams.get('managerId');

    // 1. Fetch All Users
    const { resources: allUsers } = await containers.users.items
        .query("SELECT * FROM c")
        .fetchAll();

    // 2. Fetch Usage Logs (Last 7 Days) - For all users (filtered later in memory)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateStr = sevenDaysAgo.toISOString();

    const { resources: recentLogs } = await containers.userusage.items
        .query({
            query: "SELECT * FROM c WHERE c.timestamp >= @dateStr",
            parameters: [{ name: "@dateStr", value: dateStr }]
        })
        .fetchAll();

    // 3. Determine Scope (Org vs Manager Downline)
    const targetUsers = getDownline(managerId, allUsers);
    
    if (targetUsers.length === 0) {
        return NextResponse.json({ kpis: null, teams: [], trend: [] });
    }

    // 4. Calculate Overall KPIs (Aggregate of all reports)
    const overallStats = calculateGroupStats(targetUsers, recentLogs);

    // 5. Group by Team
    const teamsMap = {}; // teamId -> [users]
    targetUsers.forEach(u => {
        const tId = u.teamId || 'Unassigned';
        if (!teamsMap[tId]) teamsMap[tId] = [];
        teamsMap[tId].push(u);
    });

    const teams = Object.keys(teamsMap).map(teamId => {
        const teamUsers = teamsMap[teamId];
        const stats = calculateGroupStats(teamUsers, recentLogs);
        return {
            teamId,
            ...stats
        };
    });

    // 6. Generate Trend (For the Overall Scope)
    // MVP: Fake trend based on current score
    const trendData = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return {
            date: d.toISOString().split('T')[0],
            activeUsers: Math.max(0, overallStats.activeUserCount - (6 - i)), // Fake ramping
            momentumScore: overallStats.momentumScore 
        };
    });

    return NextResponse.json({
        kpis: overallStats,
        teams: teams,
        trend: trendData
    });

  } catch (error) {
    console.error("Failed to fetch org trend", error);
    return NextResponse.json({ error: "Failed to fetch org trend" }, { status: 500 });
  }
}

