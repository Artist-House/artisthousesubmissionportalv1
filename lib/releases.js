import { adminCreateSubmission, adminUpdateSubmission } from "@/lib/notion";
import { syncNotionPageSafely } from "@/lib/supabase";

// Admin-portal write path: Notion first (source of truth), then the
// schema-driven mirror into release_schedule / notion_datatable / unified.
// The public portal's own route (app/api/submit-release) follows the same
// Notion-then-mirror pattern with its richer asset handling.
export async function saveRelease({
  kind = "audio",
  payload,
  session,
  notionPageId = null,
  workflow = null
}) {
  const page = notionPageId
    ? await adminUpdateSubmission(kind, notionPageId, payload, session, workflow)
    : await adminCreateSubmission(kind, payload, session, workflow);

  const synced = await syncNotionPageSafely(page);

  return {
    ok: true,
    pageId: page.id,
    syncWarning: !synced
  };
}
