import { NextResponse } from "next/server";
import { readAdminSessionFromRequest } from "@/lib/admin-auth";
import { defaultConfigForLayout } from "@/lib/admin-properties";
import {
  createSavedView,
  getSavedView,
  isValidLayout,
  listSavedViews
} from "@/lib/saved-views";

export const runtime = "nodejs";

export async function GET(request) {
  const session = await readAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    return NextResponse.json({ ok: true, views: await listSavedViews() });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Could not load views." }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await readAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = String(body?.name || "").trim();

    if (!name) {
      return NextResponse.json({ error: "View name is required." }, { status: 400 });
    }

    let layout = body?.layout;
    let config = null;

    if (body?.duplicateOf) {
      // Duplicating copies only the view's configuration, never any records.
      const source = await getSavedView(body.duplicateOf);

      if (!source) {
        return NextResponse.json({ error: "View to duplicate was not found." }, { status: 404 });
      }

      layout = source.layout;
      config = source.config;
    }

    if (!isValidLayout(layout)) {
      return NextResponse.json({ error: "Unknown view layout." }, { status: 400 });
    }

    const view = await createSavedView({
      name,
      layout,
      config: config || body?.config || defaultConfigForLayout(layout),
      createdBy: session.email || null
    });

    return NextResponse.json({ ok: true, view });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Could not create the view." }, { status: 400 });
  }
}
