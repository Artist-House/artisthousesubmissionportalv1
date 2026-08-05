import { NextResponse } from "next/server";
import { readAdminSessionFromRequest } from "@/lib/admin-auth";
import { getAdminView, ADMIN_VIEWS, DEFAULT_ADMIN_VIEW } from "@/lib/admin-views";
import { saveRelease } from "@/lib/releases";
import { listReleases } from "@/lib/supabase-releases";
import { SUBMISSION_KINDS } from "@/lib/unified-mapping";
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

export async function GET(request) {
  const session = await readAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const viewKey = searchParams.get("view") || DEFAULT_ADMIN_VIEW;
    const viewDefinition = getAdminView(viewKey);

    const result = await listReleases({
      view: viewKey,
      q: searchParams.get("q") || "",
      month: searchParams.get("month") || "",
      page: searchParams.get("page") || 1
    });

    return NextResponse.json({
      ok: true,
      view: {
        key: ADMIN_VIEWS[viewKey] ? viewKey : DEFAULT_ADMIN_VIEW,
        label: viewDefinition.label,
        columns: viewDefinition.columns
      },
      ...result
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Could not load releases." },
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
    const kind = SUBMISSION_KINDS[body?.kind] || null;

    if (!kind) {
      return NextResponse.json({ error: "Unknown submission kind." }, { status: 400 });
    }

    const payload = SCHEMAS_BY_KIND[kind].parse(body?.payload || {});
    const result = await saveRelease({
      kind,
      payload,
      session,
      workflow: extractWorkflow(payload)
    });

    return NextResponse.json({ ...result, id: `notion:${result.pageId}` });
  } catch (error) {
    const message =
      error?.issues?.[0]?.message || error?.message || "Could not create the release.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
