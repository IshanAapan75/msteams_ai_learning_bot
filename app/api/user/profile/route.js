import { containers } from "../../../../lib/cosmos";

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
