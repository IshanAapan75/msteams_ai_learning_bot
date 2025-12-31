import { containers } from "../../../lib/cosmos.js";
import React from "react";

async function getBadgeData(badgeId) {
  const { resource: badge } = await containers.badges.item(badgeId, badgeId).read();
  if (!badge) return null;

  const { resource: user } = await containers.users.item(badge.userId, badge.userId).read();
  return { badge, user };
}

export default async function BadgePage({ params }) {
  const { badgeId } = params;
  const data = await getBadgeData(badgeId);

  if (!data) {
    return <div>Badge not found</div>;
  }

  const { badge, user } = data;

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const contentUrl = `${appUrl}/badge/${badgeId}`;
  const linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    contentUrl
  )}`;

  return (
    <div style={{ fontFamily: "sans-serif", textAlign: "center", paddingTop: "50px" }}>
      <h1>Congratulations, {user.name}!</h1>
      <h2>You have earned the {badge.badgeName} badge!</h2>
      <p>Awarded on: {new Date(badge.awardedAt).toLocaleDateString()}</p>
      <a href={linkedInShareUrl} target="_blank" rel="noopener noreferrer">
        Share on LinkedIn
      </a>
    </div>
  );
}
