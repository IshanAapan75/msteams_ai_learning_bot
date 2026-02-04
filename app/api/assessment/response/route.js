const { containers } = require("../../../../lib/cosmos.js");
const { NextResponse } = require("next/server");

async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const { resources: assessmentResponses } = await containers.assessmentresponse.items
      .query({
        query: "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.timestamp DESC",
        parameters: [{ name: "@userId", value: userId }],
      })
      .fetchAll();

    return NextResponse.json(assessmentResponses[0] || null);
  } catch (error) {
    console.error("[API/assessment/response] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

module.exports = {
    GET
};