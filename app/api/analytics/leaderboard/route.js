const { containers } = require("../../../../lib/cosmos.js");
const { NextResponse } = require("next/server");

async function GET(req) {
  try {
    const { resources: users } = await containers.users.items
      .query("SELECT c.id, c.name, c.xp, c.level, c.badges FROM c ORDER BY c.xp DESC OFFSET 0 LIMIT 10")
      .fetchAll();

    return NextResponse.json(users);
  } catch (error) {
    console.error("[API/leaderboard] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

module.exports = {
    GET
};