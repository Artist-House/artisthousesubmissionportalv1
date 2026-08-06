import { NextResponse } from "next/server";
import { readAdminSessionFromRequest } from "@/lib/admin-auth";
import { deleteSavedView, getSavedView, updateSavedView } from "@/lib/saved-views";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  const session = await readAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const patch = {};

    if (typeof body?.name === "string" && body.name.trim()) {
      patch.name = body.name.trim();
    }

    if (body?.config && typeof body.config === "object") {
      patch.config = body.config;
    }

    if (Number.isInteger(body?.position)) {
      patch.position = body.position;
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const view = await updateSavedView(id, patch);

    if (!view) {
      return NextResponse.json({ error: "View not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, view });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Could not update the view." }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  const session = await readAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const view = await getSavedView(id);

    if (!view) {
      return NextResponse.json({ error: "View not found." }, { status: 404 });
    }

    // Deleting a view removes only its configuration — never any records.
    await deleteSavedView(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Could not delete the view." }, { status: 400 });
  }
}
