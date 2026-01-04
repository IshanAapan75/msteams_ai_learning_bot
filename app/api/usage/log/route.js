import { NextResponse } from "next/server";
import { getResponsesByUserId } from "../../../../lib/analytics";
import { containers } from "../../../../lib/cosmos.js";

export async function POST(req) {
  const payload = await req.json();
  const userId = payload.userId;

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const userResponse = await getResponsesByUserId(userId);

    if (!userResponse) {
      return NextResponse.json({ error: "User learning data not found" }, { status: 404 });
    }

    const currentLearning = userResponse.learnings.find(
      (l) => l.status === "completed" && !l.survey
    );

    if (!currentLearning) {
      return NextResponse.json({ error: "No active and completed learning module found to log usage for." }, { status: 400 });
    }

    // This check can be uncommented if a time delay is still desired.
    // const usageAvailableAt = currentLearning.usageAvailableAt;
    // if (usageAvailableAt) { ... }

    const submittedAt = new Date();
    const submittedAtIso = submittedAt.toISOString();

    // 1. Create the new document for the 'userusage' container
    const usageDoc = {
      id: `${userId}-${currentLearning.learningId}-${Date.now()}`,
      userId: userId,
      learningId: currentLearning.learningId,
      timestamp: submittedAtIso,
      responses: {
        actionType: payload.taskType,
        timeSaved: payload.timeSaved,
        confidence: payload.confidence,
        notes: payload.description || payload.otherTaskDescription || null,
      },
      // Storing the questions text for context, similar to bot logic
      questions: [
        { id: "actionType", text: "What did you use AI for?" },
        { id: "timeSaved", text: "How much time did you save?" },
        { id: "confidence", text: "Confidence in output quality" },
        { id: "notes", text: "Brief description" }
      ],
    };
    
    await containers.userusage.items.create(usageDoc);

    // 2. Update the 'responses' container to mark as submitted
    currentLearning.survey = {
      submittedAt: submittedAtIso,
      // Storing a reference or minimal data is also an option
      actionType: payload.taskType,
      timeSaved: payload.timeSaved,
    };
    currentLearning.updatedAt = submittedAtIso;
    currentLearning.usageAvailableAt = null; // Prevent another submission

    await containers.responses.items.upsert(userResponse);

    return NextResponse.json({ message: "Usage logged successfully", usage: usageDoc });
  } catch (error) {
    console.error("[API usage log]", error);
    return NextResponse.json({ error: "Failed to log usage" }, { status: 500 });
  }
}
