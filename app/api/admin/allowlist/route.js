import { NextResponse } from "next/server";
import { readAdminSessionFromRequest } from "@/lib/admin-auth";
import { addAllowedUser, getAllowlist, isValidEmail } from "@/lib/allowlist";

export const runtime = "nodejs";

export async function GET(request) {
  const session = await readAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    return NextResponse.json({ ok: true, users: await getAllowlist() });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Could not load the allowlist." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const session = await readAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!isValidEmail(body?.email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const result = await addAllowedUser(body.email);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Could not add the user." },
      { status: 400 }
    );
  }
}
