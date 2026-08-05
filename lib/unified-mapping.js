// Helpers for reading rows of the Supabase "unified" table (verified live
// schema). Release rows are scoped by source_collection='release_schedule' and
// keyed by unified_record_id = "notion:<notion page uuid>". Writes go through
// lib/supabase.js syncNotionPageSafely, which mirrors the Notion page using the
// schema map in release_schedule_notion_schema — nothing here builds rows.

export const UNIFIED_TABLE = "unified";

export const SUBMISSION_KINDS = {
  audio: "audio",
  video: "video",
  publishing: "publishing"
};

// Kind is derived from which per-type title field is populated.
export function deriveKindFromRow(row) {
  if (String(row?.video_release_submission || "").trim()) {
    return "video";
  }

  if (String(row?.publishing_release_submission || "").trim()) {
    return "publishing";
  }

  return "audio";
}
