import { NextResponse } from "next/server";
import { readUserByEmail } from "../../../../lib/users";

export async function POST(req) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase();
    const user = await readUserByEmail(normalizedEmail);

    if (!user) {
      return NextResponse.json({ exists: false, hasPassword: false });
    }

    return NextResponse.json({ exists: true, hasPassword: Boolean(user.passwordHash) });
  } catch (error) {
    console.error("[API auth precheck]", error);
    return NextResponse.json({ error: "Failed to verify user" }, { status: 500 });
  }
}
