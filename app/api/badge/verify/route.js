import { containers } from "../../../../lib/cosmos";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const badgeId = searchParams.get('badgeId');

  if (!userId || !badgeId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  try {
      const { resource: user } = await containers.users.item(userId, userId).read();
      if (!user) {
          return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const { resource: reward } = await containers.rewards.item(userId, userId).read();
      let hasBadge = false;
      if (reward && reward.badges) {
          hasBadge = reward.badges.includes(badgeId);
      }

      return NextResponse.json({
          hasBadge,
          userName: user.name
      });

  } catch (error) {
    console.error("Badge verify error", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
