import { containers } from "../../../../lib/cosmos";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const { resources } = await containers.assessmentresponse.items
      .query({
        query: "SELECT * FROM c WHERE c.userId = @userId",
        parameters: [{ name: "@userId", value: userId }],
      })
      .fetchAll();

    if (resources.length > 0) {
      const latestResponse = resources.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

      // Also need to return the text for confidence and usage
      const { resources: allAssessmentItems } = await containers.assessmentquestion.items.query("SELECT * FROM c").fetchAll();
      const questions = allAssessmentItems.filter(item => item.id !== 'scoring_config');
      const confidenceAnswer = latestResponse.answers.find(a => a.questionId === 'q9')?.answer;
      const usageAnswer = latestResponse.answers.find(a => a.questionId === 'q10')?.answer;
      const confidenceText = questions.find(q => q.id === 'q9')?.options.find(o => o.value === confidenceAnswer)?.text;
      const usageText = questions.find(q => q.id === 'q10')?.options.find(o => o.value === usageAnswer)?.text;
      
      return NextResponse.json({ ...latestResponse, confidence: confidenceText, usage: usageText });
    } else {
      return NextResponse.json({ error: "Assessment response not found" }, { status: 404 });
    }
  } catch (error) {
    console.error("Failed to fetch assessment response", error);
    return NextResponse.json({ error: "Failed to fetch assessment response" }, { status: 500 });
  }
}
