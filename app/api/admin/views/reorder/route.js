import { NextResponse } from "next/server";
import { readAdminSessionFromRequest } from "@/lib/admin-auth";
import { reorderSavedViews } from "@/lib/saved-views";

export const runtime = "nodejs";

export async function POST(request) {
  const session = await readAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const orderedIds = Array.isArray(body?.orderedIds) ? body.orderedIds : [];

    if (!orderedIds.length) {
      return NextResponse.json({ error: "orderedIds is required." }, { status: 400 });
    }

    await reorderSavedViews(orderedIds);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Could not reorder views." }, { status: 400 });
  }
}
