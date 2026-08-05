import { NextResponse } from "next/server";
import { readAdminSessionFromRequest } from "@/lib/admin-auth";
import { saveRelease } from "@/lib/releases";
import { getRelease } from "@/lib/supabase-releases";
import { deriveKindFromRow } from "@/lib/unified-mapping";
import {
  adminAudioPayloadSchema,
  adminPublishingPayloadSchema,
  adminVideoPayloadSchema
} from "@/lib/validation";

export const runtime = "nodejs";

const SCHEMAS_BY_KIND = {
  audio: adminAudioPayloadSchema,
  video: adminVideoPayloadSchema,
  publishing: adminPublishingPayloadSchema
};

function extractWorkflow(payload) {
  const workflow = {};

  if (payload.status) {
    workflow.status = payload.status;
  }

  if (payload.nmdStatus) {
    workflow.nmdStatus = payload.nmdStatus;
  }

  if (payload.productVersion) {
    workflow.productVersion = payload.productVersion;
  }

  return Object.keys(workflow).length ? workflow : null;
}

export async function GET(request, { params }) {
  const session = await readAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const row = await getRelease(decodeURIComponent(id));

    if (!row) {
      return NextResponse.json({ error: "Release not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, row });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Could not load the release." },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  const session = await readAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const row = await getRelease(decodeURIComponent(id));

    if (!row) {
      return NextResponse.json({ error: "Release not found." }, { status: 404 });
    }

    if (!row.notion_page_id) {
      return NextResponse.json(
        { error: "This record has no linked Notion page, so it can't be edited here yet." },
        { status: 409 }
      );
    }

    const body = await request.json();
    const kind = deriveKindFromRow(row);
    const payload = SCHEMAS_BY_KIND[kind].parse(body?.payload || {});

    const result = await saveRelease({
      kind,
      payload,
      session,
      notionPageId: row.notion_page_id,
      workflow: extractWorkflow(payload)
    });

    return NextResponse.json({ ...result, id: row.unified_record_id });
  } catch (error) {
    const message =
      error?.issues?.[0]?.message || error?.message || "Could not update the release.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
