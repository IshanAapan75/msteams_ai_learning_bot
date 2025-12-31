import { NextResponse } from "next/server";
import { readUserByEmail, ensurePassword, sanitizeUser } from "../../../../lib/users";

export async function POST(req) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await readUserByEmail(email.toLowerCase());
    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }
    if (user.passwordHash) {
      return NextResponse.json({ error: "Password already set. Please log in instead." }, { status: 409 });
    }

    const updated = await ensurePassword(user.id, password);
    const safeUser = sanitizeUser(updated);

    return NextResponse.json({ user: safeUser });
  } catch (error) {
    console.error("[API auth claim]", error);
    return NextResponse.json({ error: "Failed to claim account" }, { status: 500 });
  }
}
