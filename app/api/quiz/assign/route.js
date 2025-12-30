// import { NextResponse } from "next/server";
// import { containers } from "../../../../lib/cosmos";

// // Use the Node.js runtime for this API route
// export const runtime = 'nodejs';

// export async function POST(req) {
//   try {
//     const { userId } = await req.json();
//     console.log(`[API/quiz/assign] Received request for userId: ${userId}`);

//     // Fetch all available quizzes. Requirement states "any valid one is fine".
//     const { resources: quizzes } = await containers.quizzes.items.readAll().fetchAll();

//     if (!quizzes || quizzes.length === 0) {
//       console.warn(`[API/quiz/assign] No quizzes found in Cosmos DB.`);
//       return NextResponse.json({ error: "No quizzes available" }, { status: 404 });
//     }

//     // Return the first available quiz
//     const assignedQuiz = quizzes[0];
//     console.log(`[API/quiz/assign] Assigned quiz: ${assignedQuiz.id} to user: ${userId}`);

//     // If assignedQuiz has a questions array with string IDs, populate full question objects
//     if (assignedQuiz && Array.isArray(assignedQuiz.questions) && assignedQuiz.questions.length > 0) {
//       const populatedQuestions = [];
//       for (const qid of assignedQuiz.questions) {
//         if (typeof qid === 'string') { // Only fetch if it's an ID
//           try {
//             const { resource: q } = await containers.questions.item(qid, qid).read();
//             if (q) {
//               populatedQuestions.push(q);
//             } else {
//               console.warn(`[API/quiz/assign] Question with ID ${qid} not found.`);
//             }
//           } catch (err) {
//             console.error(`[API/quiz/assign] Error loading question ${qid}: ${err.message}`);
//           }
//         } else if (typeof qid === 'object' && qid !== null) { // Already a question object
//             populatedQuestions.push(qid);
//         }
//       }
//       assignedQuiz.questions = populatedQuestions;
//     } else {
//         console.warn(`[API/quiz/assign] Quiz ${assignedQuiz.id} has no questions array or it's empty.`);
//         // Optionally handle quizzes with no questions gracefully, e.g., return a 404
//         return NextResponse.json({ error: "Assigned quiz has no questions" }, { status: 404 });
//     }


//     return NextResponse.json({ quiz: assignedQuiz });

//   } catch (error) {
//     console.error(`[API/quiz/assign] Error processing request: ${error.message}`);
//     return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
//   }
// }












import { NextResponse } from "next/server";
import { containers } from "../../../../lib/cosmos";

export const runtime = 'nodejs';
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { userId, fetchAll } = await req.json();
    console.log(`[API/quiz/assign] Request for userId: ${userId}, fetchAll: ${fetchAll}`);

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    let aiLearningStatus = "not started";
    let responseDoc = null;
    try {
      const { resource } = await containers.responses.item(userId, userId).read();
      responseDoc = resource;
      aiLearningStatus = resource?.aiLearningStatus || "not started";
    } catch (statusError) {
      if (statusError.code !== 404) {
        console.error("[API/quiz/assign] Unable to read responses doc", statusError);
        return NextResponse.json(
          { error: "Unable to verify AI learning completion" },
          { status: 500 }
        );
      }
    }

    const ensureResponseDoc = async (updates = {}) => {
      const baseDoc = {
        id: userId,
        userId,
        aiLearningId: updates.aiLearningId ?? responseDoc?.aiLearningId ?? null,
        aiLearningStatus: updates.aiLearningStatus ?? responseDoc?.aiLearningStatus ?? "not started",
        attempts: responseDoc?.attempts ?? [],
      };
      const merged = { ...responseDoc, ...baseDoc, ...updates };
      await containers.responses.items.upsert(merged);
      responseDoc = merged;
      aiLearningStatus = merged.aiLearningStatus;
    };

    if (aiLearningStatus !== "completed") {
      try {
        const { resources: learningRecords } = await containers.ai_learning.items
          .query({
            query: "SELECT TOP 1 * FROM c WHERE c.userId = @userId AND LOWER(c.status) = 'completed'",
            parameters: [{ name: "@userId", value: userId }],
          })
          .fetchAll();

        const completedModule = learningRecords?.[0];

        if (completedModule) {
          await ensureResponseDoc({
            aiLearningId: completedModule.id ?? responseDoc?.aiLearningId ?? null,
            aiLearningStatus: "completed",
          });
        } else {
          return NextResponse.json(
            {
              error: "Complete the AI learning module before taking quizzes.",
              aiLearningStatus,
            },
            { status: 403 }
          );
        }
      } catch (learningError) {
        console.error("[API/quiz/assign] Failed to validate AI learning status", learningError);
        return NextResponse.json(
          { error: "Unable to verify AI learning completion" },
          { status: 500 }
        );
      }
    }

    // Fetch ALL quizzes
    const { resources: quizzes } = await containers.quizzes.items.readAll().fetchAll();

    if (!quizzes || quizzes.length === 0) {
      console.warn(`[API/quiz/assign] No quizzes found in Cosmos DB.`);
      return NextResponse.json({ error: "No quizzes available" }, { status: 404 });
    }

    console.log(`[API/quiz/assign] Found ${quizzes.length} quizzes`);

    // Populate questions for ALL quizzes
    const populatedQuizzes = [];
    
    for (const quiz of quizzes) {
      const populatedQuiz = { ...quiz };
      
      if (Array.isArray(quiz.questions) && quiz.questions.length > 0) {
        const populatedQuestions = [];
        
        for (const qid of quiz.questions) {
          if (typeof qid === 'string') {
            try {
              const { resource: q } = await containers.questions.item(qid, qid).read();
              if (q) {
                populatedQuestions.push(q);
                console.log(`[API/quiz/assign] Loaded question: ${q.id} for quiz: ${quiz.title}`);
              }
            } catch (err) {
              console.error(`[API/quiz/assign] Error loading question ${qid}: ${err.message}`);
            }
          } else if (typeof qid === 'object' && qid !== null) {
            populatedQuestions.push(qid);
          }
        }
        
        populatedQuiz.questions = populatedQuestions;
        console.log(`[API/quiz/assign] Quiz "${quiz.title}" has ${populatedQuestions.length} questions`);
      }
      
      populatedQuizzes.push(populatedQuiz);
    }

    console.log(`[API/quiz/assign] Returning ${populatedQuizzes.length} quizzes with questions`);
    return NextResponse.json({ quizzes: populatedQuizzes });

  } catch (error) {
    console.error(`[API/quiz/assign] Error processing request: ${error.message}`);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
