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

    if (!quizzes || quizzes.length === 0) {
      console.warn(`[API/quiz/assign] No quizzes found in Cosmos DB.`);
      return NextResponse.json({ error: "No quizzes available" }, { status: 404 });
    }

    // Return the first available quiz
    const assignedQuiz = quizzes[0];
    console.log(`[API/quiz/assign] Assigned quiz: ${assignedQuiz.id} to user: ${userId}`);

    // If assignedQuiz has a questions array with string IDs, populate full question objects
    if (assignedQuiz && Array.isArray(assignedQuiz.questions) && assignedQuiz.questions.length > 0) {
      const populatedQuestions = [];
      for (const qid of assignedQuiz.questions) {
        if (typeof qid === 'string') { // Only fetch if it's an ID
          try {
            const { resource: q } = await containers.questions.item(qid, qid).read();
            if (q) {
              populatedQuestions.push(q);
            } else {
              console.warn(`[API/quiz/assign] Question with ID ${qid} not found.`);
            }
          } catch (err) {
            console.error(`[API/quiz/assign] Error loading question ${qid}: ${err.message}`);
          }
        } else if (typeof qid === 'object' && qid !== null) { // Already a question object
            populatedQuestions.push(qid);
        }
      }
      assignedQuiz.questions = populatedQuestions;
    } else {
        console.warn(`[API/quiz/assign] Quiz ${assignedQuiz.id} has no questions array or it's empty.`);
        // Optionally handle quizzes with no questions gracefully, e.g., return a 404
        return NextResponse.json({ error: "Assigned quiz has no questions" }, { status: 404 });
    }


    return NextResponse.json({ quiz: assignedQuiz });

  } catch (error) {
    console.error(`[API/quiz/assign] Error processing request: ${error.message}`);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}