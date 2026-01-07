import { containers } from "../../../../lib/cosmos";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request) {
  // Temporary diagnostic check
  if (request.url.includes("check=true")) {
    return NextResponse.json({ status: "ok", message: "API is active" });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  console.log(`[API/assessment/response] GET request for userId: ${userId}`);

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

    if (resources && resources.length > 0) {
      const latestResponse = resources.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
      console.log(`[API/assessment/response] Found response for user: ${userId}`);

      // Also need to return the text for confidence and usage
      const { resources: allAssessmentItems } = await containers.assessmentquestion.items.query("SELECT * FROM c").fetchAll();
      const questions = allAssessmentItems.filter(item => item.id !== 'scoring_config');
      
      const confidenceAnswer = latestResponse.answers.find(a => a.questionId === 'q9')?.answer;
      const usageAnswer = latestResponse.answers.find(a => a.questionId === 'q10')?.answer;
      
      const confidenceText = questions.find(q => q.id === 'q9')?.options?.find(o => o.value === confidenceAnswer)?.text || "N/A";
      const usageText = questions.find(q => q.id === 'q10')?.options?.find(o => o.value === usageAnswer)?.text || "N/A";
      
      return NextResponse.json({ 
          found: true,
          ...latestResponse, 
          confidence: confidenceText, 
          usage: usageText 
      });
    } else {
      console.log(`[API/assessment/response] No response found for user: ${userId}`);
      return NextResponse.json({ found: false, error: "Assessment response not found" }, { status: 200 });
    }
  } catch (error) {
    console.error("[API/assessment/response] Error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
