import { containers } from "../../../../lib/cosmos.js";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return new Response("userId is required", { status: 400 });
  }

    const { resource: user } = await containers.users.item(userId, userId).read();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch learning history
    const { resources: userResponses } = await containers.responses.items
        .query({
            query: "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.timestamp DESC",
            parameters: [{ name: "@userId", value: userId }]
        })
        .fetchAll();
    
    // Map responses to history format expected by frontend
    const history = userResponses.map(r => {
        const learning = r.learnings && r.learnings.length > 0 ? r.learnings[0] : null;
        if (!learning) return null;
        
        return {
            id: learning.learningId,
            title: learning.module?.title || learning.module?.topic || "Unknown Module",
            status: learning.status, // "assigned", "completed"
            score: learning.score || 0, // Quiz score if available
            date: learning.updatedAt || r.timestamp
        };
    }).filter(h => h !== null);

    // Merge history into user object
    const userWithHistory = {
        ...user,
        history
    };

    return NextResponse.json(userWithHistory);

  } catch (error) {
    console.error("Failed to fetch user profile", error);
    return NextResponse.json({ error: "Failed to fetch user profile" }, { status: 500 });
  }
}
}

export async function PATCH(req) {
  const payload = await req.json();
  const { userId, ...updates } = payload;

  if (!userId) {
    return new Response("userId is required", { status: 400 });
  }

  try {
    const { resource: existing } = await containers.users.item(userId, userId).read();

    if (!existing) {
      return new Response("User not found", { status: 404 });
    }

    const updated = {
      ...existing,
      ...updates,
      id: existing.id,
      partitionKey: existing.partitionKey,
      updatedAt: new Date().toISOString(),
    };

    const { resource } = await containers.users.item(userId, userId).replace(updated);
    return Response.json(resource);
  } catch (error) {
    console.error("[API user profile] Failed to update user", error);
    return new Response("Failed to update profile", { status: 500 });
  }
}
