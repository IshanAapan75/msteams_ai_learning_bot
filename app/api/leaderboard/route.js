// import { containers } from "@/lib/cosmos";
import { containers } from "../../../lib/cosmos";

export const dynamic = "force-dynamic";

export async function GET() {
  const { resources: teams } = await containers.teams.items
    .query("SELECT * FROM c ORDER BY c.score DESC")
    .fetchAll();

  const { resources: users } = await containers.users.items
    .query("SELECT * FROM c ORDER BY c.xp DESC")
    .fetchAll();

  return Response.json({
    teams,
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      xp: u.xp,
      level: u.level,
      teamId: u.teamId,
    })),
  });
}
