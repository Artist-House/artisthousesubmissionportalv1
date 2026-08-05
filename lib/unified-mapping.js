// Maps portal payloads onto rows of the Supabase "unified" table.
//
// Column names verified against the live table (2026-08-05). Release-schedule
// rows are scoped by source_system='notion' + source_collection='release_schedule'
// and keyed by unified_record_id = "notion:<notion page uuid>". Dates are stored
// as Notion-style jsonb objects: { start, end, time_zone }.

export const UNIFIED_TABLE = "unified";

export const SUBMISSION_KINDS = {
  audio: "audio",
  video: "video",
  publishing: "publishing"
};

export function unifiedRecordIdForNotionPage(pageId) {
  return `notion:${pageId}`;
}

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

function toTextOrNull(value) {
  const trimmed = String(value || "").trim();

  return trimmed || null;
}

function toNotionDateOrNull(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return null;
  }

  return { start: trimmed, end: null, time_zone: null };
}

function applyWorkflow(row, workflow) {
  if (workflow?.status) {
    row.status = workflow.status;
  }

  if (workflow?.nmdStatus) {
    row.nmd_status = workflow.nmdStatus;
  }

  if (workflow?.productVersion) {
    row.product_version = [workflow.productVersion];
  }

  return row;
}

// Full row for audio dual-writes (public portal + admin edits of audio rows).
export function buildUnifiedRow({ payload, session, notionPageId, workflow, isUpdate }) {
  const now = new Date().toISOString();

  const row = {
    unified_record_id: unifiedRecordIdForNotionPage(notionPageId),
    source_system: "notion",
    source_collection: "release_schedule",
    source_record_id: notionPageId,
    notion_page_id: notionPageId,
    notion_last_edited_time: now,
    release_title: toTextOrNull(payload.title),
    type_of_release_audio:
      payload.releaseType === "album"
        ? "Album / EP"
        : payload.releaseType === "single"
          ? "Single"
          : toTextOrNull(payload.releaseType),
    label_name: toTextOrNull(payload.labelName),
    display_artist: toTextOrNull(payload.mainArtists),
    p_line: toTextOrNull(payload.pLine),
    featured_artists: toTextOrNull(payload.featuredArtists),
    release_version: toTextOrNull(payload.releaseVersion),
    tracklist: toTextOrNull(payload.tracklist || payload.waterfallTracklist),
    explicit: toTextOrNull(payload.explicit),
    tags: Array.isArray(payload.dealTags) ? payload.dealTags : [],
    distribution: payload.distributor ? [payload.distributor] : [],
    main_genre: toTextOrNull(payload.mainGenre),
    sub_genre: toTextOrNull(payload.subGenre),
    secondary_genre: toTextOrNull(payload.secondaryGenre),
    secondary_sub_genre: toTextOrNull(payload.secondarySubGenre),
    release_date: toNotionDateOrNull(payload.releaseDate),
    pre_order_date: toNotionDateOrNull(payload.preorderDate),
    recording_date: toNotionDateOrNull(payload.recordingDate),
    socials_release_date: toNotionDateOrNull(payload.socialReleaseDate),
    audio_files_link: toTextOrNull(payload.audioFileLink),
    dolby_atmos_mixs_2: toTextOrNull(payload.dolbyAtmosLink),
    apple_motion_art: toTextOrNull(payload.appleMotionArtLink),
    waterfall_release: toTextOrNull(payload.waterfallRelease),
    writers_splits: toTextOrNull(payload.writersSplits),
    publisher_information: toTextOrNull(payload.publisherInformation),
    producers_other_credits: toTextOrNull(payload.producerCredits),
    notes: toTextOrNull(payload.notes),
    // Asset checkmarks (✓ properties in Notion).
    cover_art: Boolean(payload.coverArtUrl),
    lyrics: Boolean(payload.lyricsUrl),
    dolby_atmos_mixs: Boolean(payload.dolbyAtmosLink),
    apple_motion_art_2: Boolean(payload.appleMotionArtLink),
    master_audio_file: Boolean(payload.audioFileLink),
    submitters_email: toTextOrNull(session?.email)
  };

  if (isUpdate) {
    // Never let an edit reset workflow state or the original submitter.
    delete row.submitters_email;
  } else {
    row.notion_created_time = now;
  }

  return applyWorkflow(row, workflow);
}

// Column patches for video/publishing rows, which are edited Supabase-first
// until their Notion property builders are added.
export function buildUnifiedPatchForKind(kind, payload, workflow) {
  if (kind === "video") {
    const patch = {
      release_title: toTextOrNull(payload.title),
      display_artist: toTextOrNull(payload.mainArtists),
      label_name: toTextOrNull(payload.labelName),
      video_link: toTextOrNull(payload.videoLink),
      release_date: toNotionDateOrNull(payload.releaseDate),
      socials_release_date: toNotionDateOrNull(payload.socialReleaseDate),
      notes: toTextOrNull(payload.notes),
      notion_last_edited_time: new Date().toISOString()
    };

    // "Please select what applies to this release" lives in product_version.
    if (Array.isArray(payload.videoApplies)) {
      patch.product_version = payload.videoApplies;
    }

    if (workflow?.status) {
      patch.status = workflow.status;
    }

    return patch;
  }

  if (kind === "publishing") {
    const patch = {
      release_title: toTextOrNull(payload.title),
      display_artist: toTextOrNull(payload.mainArtists),
      label_name: toTextOrNull(payload.labelName),
      writers_splits: toTextOrNull(payload.writersSplits),
      publisher_information: toTextOrNull(payload.publisherInformation),
      producers_other_credits: toTextOrNull(payload.producerCredits),
      release_date: toNotionDateOrNull(payload.releaseDate),
      notes: toTextOrNull(payload.notes),
      notion_last_edited_time: new Date().toISOString()
    };

    if (workflow?.status) {
      patch.status = workflow.status;
    }

    return patch;
  }

  throw new Error(`No unified patch mapping for kind: ${kind}`);
}

// New video/publishing rows created from the admin portal (Supabase-first;
// they get a portal-scoped record id since no Notion page exists yet).
export function buildUnifiedInsertForKind(kind, payload, workflow, session) {
  const patch = buildUnifiedPatchForKind(kind, payload, workflow);
  const recordId = `portal:${crypto.randomUUID()}`;

  const row = {
    ...patch,
    unified_record_id: recordId,
    source_system: "portal",
    source_collection: "release_schedule",
    submitters_email: toTextOrNull(session?.email),
    notion_created_time: new Date().toISOString()
  };

  if (kind === "video") {
    row.video_release_submission = toTextOrNull(payload.title) || "Untitled";
  }

  if (kind === "publishing") {
    row.publishing_release_submission = toTextOrNull(payload.title) || "Untitled";
    row.publishing_tag = "Publishing";
  }

  return row;
}
