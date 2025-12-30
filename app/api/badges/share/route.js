export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const badgeId = searchParams.get("badgeId");

  if (!badgeId) {
    return new Response("badgeId is required", { status: 400 });
  }

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const contentUrl = `${appUrl}/badge/${badgeId}`;
  const linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    contentUrl
  )}`;

  return Response.json({
    shareUrl: linkedInShareUrl,
  });
}
