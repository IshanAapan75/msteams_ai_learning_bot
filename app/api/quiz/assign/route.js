import { NextResponse } from "next/server";
import { containers } from "../../../../lib/cosmos";

// Use the Node.js runtime for this API route
export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const { userId } = await req.json();
    console.log(`[API/quiz/assign] Received request for userId: ${userId}`);

    // Fetch all available quizzes. Requirement states "any valid one is fine".
    const { resources: quizzes } = await containers.quizzes.items.readAll().fetchAll();

    if (quizzes.length === 0) {
      console.warn(`[API/quiz/assign] No quizzes found in Cosmos DB.`);
      return NextResponse.json({ error: "No quizzes available" }, { status: 404 });
    }

    // Return the first available quiz
    const assignedQuiz = quizzes[0];
    console.log(`[API/quiz/assign] Assigned quiz: ${assignedQuiz.id} to user: ${userId}`);

    return NextResponse.json({ quiz: assignedQuiz });

  } catch (error) {
    console.error(`[API/quiz/assign] Error processing request: ${error.message}`);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}