import { NextResponse } from "next/server";
import { verifyPassword, sanitizeUser } from "../../../../lib/users";

export async function POST(req) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await verifyPassword(email.toLowerCase(), password);
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    return NextResponse.json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error("[API auth login]", error);
    return NextResponse.json({ error: "Failed to log in" }, { status: 500 });
  }
}
