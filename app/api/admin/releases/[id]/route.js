import { NextResponse } from "next/server";
import { readAdminSessionFromRequest } from "@/lib/admin-auth";
import { saveRelease } from "@/lib/releases";
import { getRelease, updateRelease } from "@/lib/supabase-releases";
import { buildUnifiedPatchForKind, deriveKindFromRow } from "@/lib/unified-mapping";
import {
  adminAudioPayloadSchema,
  publishingPayloadSchema,
  videoPayloadSchema
} from "@/lib/validation";

export const runtime = "nodejs";

const SCHEMAS_BY_KIND = {
  audio: adminAudioPayloadSchema,
  video: videoPayloadSchema,
  publishing: publishingPayloadSchema
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
    const row = await getRelease(id);

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
    const row = await getRelease(id);

    if (!row) {
      return NextResponse.json({ error: "Release not found." }, { status: 404 });
    }

    const body = await request.json();
    const kind = deriveKindFromRow(row);
    const schema = SCHEMAS_BY_KIND[kind] || adminAudioPayloadSchema;
    const payload = schema.parse(body?.payload || {});
    const workflow = extractWorkflow(payload);

    if (kind === "audio" && row.notion_page_id) {
      const result = await saveRelease({
        kind,
        payload,
        session,
        notionPageId: row.notion_page_id,
        workflow,
        asAdmin: true
      });

      return NextResponse.json(result);
    }

    // Video/publishing rows (and audio rows with no Notion correlation yet)
    // update Supabase only until Phase 0 reconciles their Notion mappings.
    const patch =
      kind === "audio"
        ? null
        : buildUnifiedPatchForKind(kind, payload, workflow);

    if (!patch) {
      return NextResponse.json(
        { error: "This release has no Notion link yet; edit it in Notion or re-sync first." },
        { status: 409 }
      );
    }

    const updated = await updateRelease(id, patch);

    return NextResponse.json({ ok: true, id: updated?.unified_record_id, notionSkipped: true });
  } catch (error) {
    const message =
      error?.issues?.[0]?.message || error?.message || "Could not update the release.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
