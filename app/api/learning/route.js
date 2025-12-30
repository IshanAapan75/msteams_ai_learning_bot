import { containers } from "../../../lib/cosmos";
import { NextResponse } from "next/server";
import { awardXpAction } from "../../../lib/rewards";

export const dynamic = "force-dynamic";

async function upsertResponseStatus({ userId, aiLearningId, status }) {
  if (!userId) {
    return;
  }

  const normalizedStatus = status || "not started";

  let existing;
  try {
    const { resource } = await containers.responses.item(userId, userId).read();
    existing = resource;
  } catch (error) {
    if (error.code !== 404) {
      throw error;
    }
  }

  const responseDoc = {
    id: userId,
    userId,
    aiLearningId: aiLearningId ?? existing?.aiLearningId ?? null,
    aiLearningStatus: normalizedStatus,
    attempts: existing?.attempts ?? [],
    ...existing,
  };

  responseDoc.aiLearningId = aiLearningId ?? responseDoc.aiLearningId;
  responseDoc.aiLearningStatus = normalizedStatus;

  await containers.responses.items.upsert(responseDoc);
}

export async function POST(req) {
  const learningModule = await req.json();

  if (!learningModule.status) {
    learningModule.status = "not started";
  }

  const { resource: createdModule } = await containers.ai_learning.items.create(learningModule);

  if (
    learningModule.userId &&
    typeof learningModule.status === "string" &&
    learningModule.status.toLowerCase() === "completed"
  ) {
    await upsertResponseStatus({
      userId: learningModule.userId,
      aiLearningId: createdModule.id,
      status: "completed",
    });

    await awardXpAction({
      userId: learningModule.userId,
      actionType: "micro-learning",
      metadata: {
        details: {
          learningId: createdModule.id,
        },
      },
    });
  }

  return NextResponse.json(createdModule);
}

export async function PATCH(req) {
  const payload = await req.json();
  const { learningId, userId, status, ...rest } = payload;

  if (!learningId) {
    return NextResponse.json({ error: "learningId is required" }, { status: 400 });
  }

  try {
    const { resource: existing } = await containers.ai_learning
      .item(learningId, learningId)
      .read();

    if (!existing) {
      return NextResponse.json({ error: "Learning module not found" }, { status: 404 });
    }

    const updated = {
      ...existing,
      ...rest,
    };

    if (status) {
      updated.status = status;
    }

    const { resource } = await containers.ai_learning.item(learningId, learningId).replace(updated);

    if (userId && status) {
      await upsertResponseStatus({
        userId,
        aiLearningId: learningId,
        status,
      });

      if (status.toLowerCase() === "completed") {
        await awardXpAction({
          userId,
          actionType: "micro-learning",
          metadata: {
            details: {
              learningId,
            },
          },
        });
      }
    }

    return NextResponse.json(resource);
  } catch (error) {
    console.error("[API/learning] Failed to update module", error);
    return NextResponse.json({ error: "Failed to update learning module" }, { status: 500 });
  }
}

export async function GET() {
  const { resources: learningModules } = await containers.ai_learning.items.readAll().fetchAll();
  return NextResponse.json(learningModules);
}
