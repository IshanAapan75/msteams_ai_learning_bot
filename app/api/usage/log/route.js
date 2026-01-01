import { NextResponse } from "next/server";
import { getResponsesByUserId } from "../../../../lib/analytics";
import { containers } from "../../../../lib/cosmos.js";

export async function POST(req) {
  const payload = await req.json();
  const userId = payload.userId; // Assuming userId is passed in the payload for now.
                               // In a real app, this should come from authenticated session.

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const userResponse = await getResponsesByUserId(userId);

    if (!userResponse) {
      return NextResponse.json({ error: "User learning data not found" }, { status: 404 });
    }

    const currentLearning = userResponse.learnings.find(
      (l) => l.status === "assigned" || (l.status === "completed" && !l.survey)
    );

    if (!currentLearning) {
      return NextResponse.json({ error: "No active or completable learning module found to log usage for." }, { status: 404 });
    }

    // Update the survey data for the current learning module
    currentLearning.survey = {
      actionType: payload.taskType,
      timeSaved: payload.timeSaved,
      confidence: payload.confidence,
      notes: payload.description || payload.otherTaskDescription || null,
      submittedAt: new Date().toISOString(),
    };
    currentLearning.updatedAt = new Date().toISOString();

    // Persist the updated userResponse document
    await containers.responses.items.upsert(userResponse);

    return NextResponse.json({ message: "Usage logged successfully", learning: currentLearning });
  } catch (error) {
    console.error("[API usage log]", error);
    return NextResponse.json({ error: "Failed to log usage" }, { status: 500 });
  }
}
