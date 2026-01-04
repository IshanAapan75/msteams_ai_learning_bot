import { NextResponse } from "next/server";
import { containers } from "../../../../lib/cosmos";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    const { resources: usageLogs } = await containers.userusage.items
      .query({
        query: "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.timestamp DESC",
        parameters: [{ name: "@userId", value: userId }],
      })
      .fetchAll();

    return NextResponse.json(usageLogs);
  } catch (error) {
    console.error("[API get usage logs]", error);
    return NextResponse.json({ error: "Failed to fetch usage logs" }, { status: 500 });
  }
}
