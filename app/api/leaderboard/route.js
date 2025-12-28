import { containers } from "@/lib/cosmos";

export async function GET() {
  const query = {
    query: "SELECT c.teamId, SUM(c.xp) as totalXp FROM c GROUP BY c.teamId",
  };

  const { resources } =
    await containers.users.items.query(query).fetchAll();

  return Response.json(resources);
}