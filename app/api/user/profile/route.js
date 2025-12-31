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
    return new Response("User not found", { status: 404 });
  }

  return Response.json(user);
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
