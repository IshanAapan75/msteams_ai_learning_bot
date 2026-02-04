const { containers } = require("../../../../lib/cosmos.js");
const { NextResponse } = require("next/server");
const { upsertUserProfile, sanitizeUser } = require("../../../../lib/users.js");
const { fetchResponseProgress } = require("../../../../lib/learningProgress.js");

async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const { resource: user } = await containers.users.item(userId, userId).read();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const progress = await fetchResponseProgress(userId);
    const rewardRes = await containers.rewards.item(userId, userId).read();
    const reward = rewardRes.resource;

    const profile = sanitizeUser(user);
    profile.xp = reward?.xp || user.xp || 0;
    profile.level = reward?.level || user.level || 1;
    profile.fluencyScore = reward?.fluency || user.fluencyScore || 0;
    profile.streak = reward?.streak || user.streak || 0;
    profile.badges = reward?.badges || user.badges || [];
    
    // Add learning history summary
    profile.learningHistory = (progress.learnings || []).map(r => ({
        learningId: r.learningId,
        status: r.status,
        date: r.updatedAt || r.timestamp,
        topic: r.module?.topic || r.topic
    }));

    return NextResponse.json(profile);
  } catch (error) {
    console.error("[API/user/profile] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

async function PATCH(req) {
  try {
    const body = await req.json();
    const { userId, ...updates } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const updated = await upsertUserProfile({ id: userId, ...updates });
    return NextResponse.json(sanitizeUser(updated));
  } catch (error) {
    console.error("[API/user/profile] PATCH Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

module.exports = {
    GET,
    PATCH
};