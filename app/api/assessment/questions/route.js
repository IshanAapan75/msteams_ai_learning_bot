import { containers } from "../../../../lib/cosmos";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { resources: allAssessmentItems } = await containers.assessmentquestion.items.query("SELECT * FROM c").fetchAll();
    
    if (!allAssessmentItems || allAssessmentItems.length === 0) {
      return NextResponse.json({ error: "Assessment questions not found" }, { status: 404 });
    }

    const questions = allAssessmentItems
      .filter(item => item.id !== 'scoring_config')
      .sort((a, b) => a.id.localeCompare(b.id));

    return NextResponse.json(questions);
  } catch (error) {
    console.error("Failed to fetch assessment questions", error);
    return NextResponse.json({ error: "Failed to fetch assessment questions" }, { status: 500 });
  }
}
