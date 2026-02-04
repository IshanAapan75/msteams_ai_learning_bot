const { containers } = require("../../../../lib/cosmos.js");
const { NextResponse } = require("next/server");

async function GET(req) {
  try {
    const { resources: allItems } = await containers.assessmentquestion.items.query("SELECT * FROM c").fetchAll();
    
    const questions = allItems
      .filter(i => i.id !== 'scoring_config')
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' }));
      
    const scoringConfig = allItems.find(i => i.id === 'scoring_config');

    return NextResponse.json({
      questions,
      scoringConfig
    });
  } catch (error) {
    console.error("[API/assessment/questions] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

module.exports = {
    GET
};