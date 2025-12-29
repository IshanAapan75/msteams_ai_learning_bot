// import { containers } from "@/lib/cosmos";

import { containers } from "../../../../lib/cosmos";

export async function POST(req) {
  const { userId } = await req.json();
  const { resource: user } = await containers.users.item(userId, userId).read();

  const query = {
    query: "SELECT * FROM c WHERE c.designation = @d",
    parameters: [{ name: "@d", value: user.designation }],
  };

  const { resources } =
    await containers.quizzes.items.query(query).fetchAll();

  if (resources.length === 0) {
    return new Response("No quiz found for your designation", { status: 404 });
  }

  return Response.json({ quiz: resources[0] });
}
