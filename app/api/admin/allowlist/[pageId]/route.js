import { NextResponse } from "next/server";
import { readAdminSessionFromRequest } from "@/lib/admin-auth";
import { editAllowedUser, isValidEmail, removeAllowedUser } from "@/lib/allowlist";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  const session = await readAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { pageId } = await params;
    const body = await request.json();

    if (!isValidEmail(body?.email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const result = await editAllowedUser(pageId, body.email);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Could not update the user." },
      { status: 400 }
    );
  }
}

export async function DELETE(request, { params }) {
  const session = await readAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { pageId } = await params;
    const result = await removeAllowedUser(pageId);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Could not remove the user." },
      { status: 400 }
    );
  }
}
