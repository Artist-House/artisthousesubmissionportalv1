import {
  adminUpdateReleaseSubmission,
  createReleaseSubmission,
  updateReleaseSubmission
} from "@/lib/notion";
import { getSupabaseAdmin } from "@/lib/supabase";
import { buildUnifiedRow, UNIFIED_TABLE } from "@/lib/unified-mapping";

// Status casing matches the live Notion status options exactly.
const KIND_WORKFLOW_DEFAULTS = {
  audio: {
    status: "Not started",
    nmdStatus: "Queue",
    productVersion: "All DSPs (Main)"
  },
  video: {
    status: "Not started"
  },
  publishing: {
    status: "External"
  }
};

async function upsertUnifiedRow(row) {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from(UNIFIED_TABLE)
    .upsert(row, { onConflict: "unified_record_id" });

  if (error) {
    throw new Error(error.message);
  }
}

async function syncUnifiedRow(args) {
  const row = buildUnifiedRow(args);

  try {
    await upsertUnifiedRow(row);

    return true;
  } catch (firstError) {
    try {
      await upsertUnifiedRow(row);

      return true;
    } catch (secondError) {
      console.error(
        `Supabase sync failed for Notion page ${args.notionPageId}: ${firstError.message}; retry: ${secondError.message}`
      );

      return false;
    }
  }
}

// Single write path for every submission create/edit (public portal and admin).
// Notion is written first because it mints the page id used to correlate the
// Supabase row; the Supabase upsert is idempotent on notion_page_id. A Supabase
// failure never fails the request — it is logged and surfaced as syncWarning.
export async function saveRelease({
  kind = "audio",
  payload,
  files = { lyricsFile: null, coverArtFile: null },
  session,
  notionPageId = null,
  workflow = null,
  asAdmin = false
}) {
  const isUpdate = Boolean(notionPageId);
  const effectiveWorkflow =
    workflow || (isUpdate ? null : KIND_WORKFLOW_DEFAULTS[kind] || null);

  let page;

  if (!isUpdate) {
    page = await createReleaseSubmission(payload, files, session, effectiveWorkflow);
  } else if (asAdmin) {
    page = await adminUpdateReleaseSubmission(
      notionPageId,
      payload,
      files,
      session,
      effectiveWorkflow
    );
  } else {
    page = await updateReleaseSubmission(notionPageId, payload, files, session);
  }

  const synced = await syncUnifiedRow({
    payload,
    session,
    notionPageId: page.id,
    workflow: effectiveWorkflow,
    isUpdate
  });

  return {
    ok: true,
    pageId: page.id,
    syncWarning: !synced
  };
}
