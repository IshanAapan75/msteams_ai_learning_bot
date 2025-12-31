import { containers } from "./cosmos.js";
import bcrypt from "bcryptjs";

const PASSWORD_SALT_ROUNDS = 10;

export async function upsertUserProfile(partialProfile = {}) {
  if (!partialProfile.id) {
    throw new Error("upsertUserProfile requires an id field");
  }

  const users = containers.users;
  const existing = await readUserById(partialProfile.id);
  const now = new Date().toISOString();

  if (!existing) {
    const doc = {
      ...partialProfile,
      passwordHash: null,
      passwordSetAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await users.items.create(doc);
    return doc;
  }

  const updated = {
    ...existing,
    ...partialProfile,
    name: partialProfile.name ?? existing.name,
    email: partialProfile.email ?? existing.email,
    designation: partialProfile.designation ?? existing.designation ?? null,
    teamId: partialProfile.teamId ?? existing.teamId ?? null,
    teamName: partialProfile.teamName ?? existing.teamName ?? null,
    language: partialProfile.language ?? existing.language ?? null,
    lastSeenAt: partialProfile.lastSeenAt ?? existing.lastSeenAt ?? now,
    id: existing.id,
    partitionKey: existing.partitionKey,
    updatedAt: now,
  };

  await users.items.upsert(updated);
  return updated;
}

export async function readUserById(userId) {
  if (!userId) {
    return null;
  }
  try {
    const { resource } = await containers.users.item(userId, userId).read();
    return resource || null;
  } catch (error) {
    if (error.code === 404) {
      return null;
    }
    throw error;
  }
}

export async function readUserByEmail(email) {
  if (!email) {
    return null;
  }

  const query = {
    query: "SELECT * FROM c WHERE c.email = @email",
    parameters: [{ name: "@email", value: email.toLowerCase() }],
  };

  const { resources } = await containers.users.items.query(query).fetchAll();
  return resources?.[0] || null;
}

export async function ensurePassword(userId, rawPassword) {
  if (!rawPassword) {
    throw new Error("Password is required");
  }
  const user = await readUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }
  const hash = await bcrypt.hash(rawPassword, PASSWORD_SALT_ROUNDS);
  const now = new Date().toISOString();
  user.passwordHash = hash;
  user.passwordSetAt = now;
  user.updatedAt = now;
  await containers.users.items.upsert(user);
  return user;
}

export async function verifyPassword(email, rawPassword) {
  const user = await readUserByEmail(email);
  if (!user || !user.passwordHash) {
    return null;
  }

  const matches = await bcrypt.compare(rawPassword, user.passwordHash);
  return matches ? user : null;
}

export async function ensureUserHasProfile(userId, attributes = {}) {
  if (!userId) {
    throw new Error("ensureUserHasProfile requires userId");
  }

  const existing = await readUserById(userId);
  if (existing) {
    return existing;
  }

  const profile = await upsertUserProfile({
    id: userId,
    xp: 0,
    level: 1,
    badges: [],
    ...attributes,
  });
  return profile;
}

export function sanitizeUser(user) {
  if (!user) {
    return null;
  }
  const { passwordHash, partitionKey, ...safe } = user;
  return safe;
}

