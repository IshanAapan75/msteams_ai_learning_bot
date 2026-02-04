const { containers } = require("../../../../lib/cosmos.js");
const { NextResponse } = require("next/server");

async function GET(req) {
  try {
    const { resources: allUsers } = await containers.users.items.readAll().fetchAll();
    const { resources: allUsage } = await containers.userusage.items.readAll().fetchAll();

    const totalUsers = allUsers.length;
    const totalUsage = allUsage.length;
    const avgXP = allUsers.reduce((sum, u) => sum + (u.xp || 0), 0) / (totalUsers || 1);

    return NextResponse.json({
      totalUsers,
      totalUsage,
      avgXP: Math.round(avgXP)
    });
  } catch (error) {
    console.error("[API/analytics/overview] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

module.exports = {
    GET
};