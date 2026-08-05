// Declarative definitions of the internal release-schedule views, verified
// against the live Supabase "unified" table. Each view is a set of filters +
// the columns that apply to it (column lists mirror the corresponding Notion
// views); lib/supabase-releases.js translates them into PostgREST queries and
// the admin table renders whatever columns a view declares.
//
// Notes on the live schema:
// - Release rows are scoped by source_collection = 'release_schedule' (applied
//   to every view by the query layer, not repeated here).
// - Dates are jsonb { start, end, time_zone }; filters/sorts use the
//   "release_date->>start" JSON path with ISO string comparison.
// - Kind: video rows have video_release_submission set, publishing rows have
//   publishing_release_submission set, everything else is audio.
// - Status values are exact: "Not started", "In progress", etc.

export const ADMIN_TIMEZONE = "America/New_York";

const RELEASE_DATE_START = "release_date->>start";

function formatInAdminTimezone(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ADMIN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function todayInAdminTimezone() {
  return formatInAdminTimezone(new Date());
}

export function monthAgoInAdminTimezone() {
  const date = new Date();

  date.setDate(date.getDate() - 30);

  return formatInAdminTimezone(date);
}

export function nextFridayInAdminTimezone() {
  const now = new Date();

  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: ADMIN_TIMEZONE,
      weekday: "short"
    }).format(candidate);

    if (weekday === "Fri") {
      return formatInAdminTimezone(candidate);
    }
  }

  return todayInAdminTimezone();
}

const ACTIVE_STATUSES = ["Delivered", "In progress", "Scheduled"];
const TAKEN_DOWN_STATUSES = ["Taken Down", "Taken Down (Manually)"];

// Shorthand column builders.
const col = (key, label, render = "text") => ({ key, label, render });

const TITLE = col("release_title", "Release Title", "link");
const ARTIST = col("display_artist", "Display Artist");
const STATUS = col("status", "Status", "badge");
const RELEASE_DATE = col("release_date", "Release Date", "notion-date");

const BASE_COLUMNS = [
  TITLE,
  ARTIST,
  RELEASE_DATE,
  STATUS,
  col("distribution", "Distribution", "tags"),
  col("tags", "Tags", "tags")
];

// Mirrors the Notion "Upcoming Releases" view's shown properties.
const UPCOMING_COLUMNS = [
  TITLE,
  col("missing_assets", "Missing Assets", "notion-formula"),
  STATUS,
  RELEASE_DATE,
  ARTIST,
  col("assets_due_date", "Assets Due Date", "notion-date"),
  col("product_version", "Product Version", "tags"),
  col("tags", "Tags", "tags"),
  col("publishing_tag", "Publishing Tag"),
  col("distribution", "Distribution", "tags"),
  col("notes", "Notes"),
  col("ar_admin_clearance", "A&R Admin Clearance", "check"),
  col("master_audio_file", "Master Audio File ✓", "check"),
  col("cover_art", "Cover Art ✓", "check"),
  col("product_label_copy", "Product Label Copy ✓", "check"),
  col("disco_listening_link", "DISCO Listening Link", "url"),
  col("disco_download_link", "DISCO Download Link", "url"),
  col("embed_code", "Embed Code"),
  col("upc", "UPC"),
  col("catalog", "Catalog #"),
  col("isrc", "ISRC"),
  col("main_genre", "Main Genre"),
  col("sub_genre", "Sub Genre"),
  col("secondary_genre", "Secondary Genre"),
  col("secondary_sub_genre", "Secondary Sub Genre"),
  col("tracklist", "Tracklist"),
  col("release_highlights", "Release Highlights", "relation"),
  col("artist", "Artist", "relation"),
  col("audio_release_submission_label_management", "Audio Release Submission"),
  col("video_release_submission", "Video Release Submission"),
  col("type_of_release_audio", "Type of Release (Audio)")
];

// Mirrors the Notion "TBD Releases" view's shown properties.
const TBD_COLUMNS = [
  STATUS,
  RELEASE_DATE,
  col("assets_due_date", "Assets Due Date", "notion-date"),
  ARTIST,
  TITLE,
  col("notes", "Notes"),
  col("product_version", "Product Version", "tags"),
  col("tags", "Tags", "tags"),
  col("disco_listening_link", "DISCO Listening Link", "url"),
  col("artist", "Artist", "relation"),
  col("audio_release_submission_label_management", "Audio Release Submission"),
  col("video_release_submission", "Video Release Submission"),
  col("tracklist", "Tracklist"),
  col("ar_admin_clearance", "A&R Admin Clearance", "check")
];

// Mirrors the Notion "Chartmetric" view's shown properties.
const CHARTMETRIC_COLUMNS = [
  RELEASE_DATE,
  ARTIST,
  TITLE,
  col("product_version", "Product Version", "tags"),
  col("tags", "Tags", "tags"),
  col("disco_listening_link", "DISCO Listening Link", "url"),
  col("disco_download_link", "DISCO Download Link", "url"),
  col("catalog", "Catalog #"),
  col("artist", "Artist", "relation"),
  col("chartmetric_url", "Chartmetric URL", "url"),
  col("spotify", "Spotify", "url"),
  col("apple", "Apple", "url"),
  col("soundcloud", "Soundcloud", "url"),
  col("you_tube", "YouTube", "url"),
  col("deezer", "Deezer", "url"),
  col("tik_tok", "TikTok", "url"),
  col("amazon", "Amazon", "url"),
  col("pandora", "Pandora", "url"),
  col("shazam", "Shazam", "url"),
  col("musixmatch", "Musixmatch", "check"),
  col("release_highlights", "Release Highlights", "relation")
];

// Mirrors the Notion "Publishing" view's shown properties.
const PUBLISHING_VIEW_COLUMNS = [
  col("date_added", "Date Added", "notion-date"),
  RELEASE_DATE,
  ARTIST,
  TITLE,
  col("release_version", "Release Version"),
  col("alts_stems", "Alts/Stems", "tags"),
  col("label_name", "Label Name"),
  col("creation_date", "Creation Date", "notion-date"),
  col("audio_files_link", "Audio File(s) Link", "url"),
  col("ah_writers_splits", "AH Writer(s) & Splits"),
  col("ah_writers_pub_info", "AH Writer(s) Pub Info"),
  col("tp_writers_splits", "TP Writer(s) & Splits"),
  col("tp_writers_pub_info", "TP Writer(s) Pub Info"),
  col("deal_type", "Deal Type", "tags"),
  col("isrc", "ISRC"),
  col("iswc", "ISWC"),
  col("contains_sample", "Contains Sample"),
  col("sample_title_writers", "Sample Title & Writers"),
  col("publishing_release_submission", "Publishing Release Submission"),
  col("curve", "Curve", "check"),
  col("curve_date_submitted", "Curve Date Submitted", "notion-date"),
  col("disco", "DISCO", "check"),
  col("disco_date_submitted", "DISCO Date Submitted", "notion-date"),
  col("mlc", "MLC", "check"),
  col("mlc_date_submitted", "MLC Date Submitted", "notion-date"),
  col("musicmark", "Musicmark", "check"),
  col("musicmark_date_submitted", "Musicmark Date Submitted", "notion-date"),
  col("ascap", "ASCAP", "check"),
  col("ascap_date_submitted", "ASCAP Date Submitted", "notion-date"),
  col("bmi", "BMI", "check"),
  col("bmi_date_submitted", "BMI Date Submitted", "notion-date"),
  col("cmrra", "CMRRA", "check"),
  col("cmrra_date_submitted", "CMRRA Date Submitted", "notion-date"),
  col("socan", "SOCAN", "check"),
  col("socan_date_submitted", "SOCAN Date Submitted", "notion-date"),
  col("prs", "PRS", "check"),
  col("prs_date_submitted", "PRS Date Submitted", "notion-date"),
  col("kobalt", "Kobalt", "check"),
  col("kobalt_date_submitted", "Kobalt Date Submitted", "notion-date"),
  col("spirit", "Spirit", "check"),
  col("spirit_date_submitted", "Spirit Date Submitted", "notion-date"),
  col("regard", "Regard", "check"),
  col("regard_date_submitted", "Regard Date Submitted", "notion-date"),
  col("spotify_pub", "Spotify (Pub)", "check"),
  col("spotify_date_submitted", "Spotify Date Submitted", "notion-date"),
  col("umpg", "UMPG", "check"),
  col("umpg_date_submitted", "UMPG Date Submitted", "notion-date"),
  col("music_reports", "Music Reports", "check"),
  col("music_reports_submitted", "Music Reports Submitted", "notion-date"),
  col("music_admin", "Music Admin", "check"),
  col("music_admin_submitted", "Music Admin Submitted", "notion-date"),
  col("notes", "Notes")
];

const AUDIO_COLUMNS = [
  TITLE,
  ARTIST,
  col("type_of_release_audio", "Type"),
  col("label_name", "Label"),
  RELEASE_DATE,
  STATUS,
  col("product_version", "Product Version", "tags"),
  col("distribution", "Distribution", "tags"),
  col("explicit", "Explicit"),
  col("main_genre", "Genre")
];

const VIDEO_COLUMNS = [
  TITLE,
  ARTIST,
  col("product_version", "Applies To", "tags"),
  RELEASE_DATE,
  STATUS,
  col("video_dsps", "Video DSPs", "tags"),
  col("video_link", "Video Link", "url"),
  col("label_name", "Label")
];

const PUBLISHING_SUBMISSION_COLUMNS = [
  TITLE,
  ARTIST,
  col("ah_writers_splits", "AH Writer(s) & Splits"),
  col("tp_writers_splits", "TP Writer(s) & Splits"),
  col("deal_type", "Deal Type", "tags"),
  RELEASE_DATE,
  STATUS
];

const ASSET_CHECKLIST_COLUMNS = [
  TITLE,
  ARTIST,
  RELEASE_DATE,
  STATUS,
  col("cover_art", "Cover Art", "check"),
  col("lyrics", "Lyrics", "check"),
  col("master_audio_file", "Audio", "check"),
  col("dolby_atmos_mixs", "Dolby Atmos", "check"),
  col("apple_motion_art_2", "Motion Art", "check"),
  col("music_video_file", "Video", "check")
];

// "Entire Database": every mapped field on the release schedule.
const ENTIRE_DB_COLUMNS = [
  TITLE,
  ARTIST,
  STATUS,
  col("nmd_status", "NMD Status", "badge"),
  RELEASE_DATE,
  col("type_of_release_audio", "Type of Release (Audio)"),
  col("audio_release_submission_label_management", "Audio Release Submission"),
  col("video_release_submission", "Video Release Submission"),
  col("publishing_release_submission", "Publishing Release Submission"),
  col("publishing_tag", "Publishing Tag"),
  col("label_name", "Label Name"),
  col("p_line", "P-Line"),
  col("featured_artists", "Featured Artist(s)"),
  col("release_version", "Release Version"),
  col("product_version", "Product Version", "tags"),
  col("tags", "Tags", "tags"),
  col("deal_type", "Deal Type", "tags"),
  col("distribution", "Distribution", "tags"),
  col("distributor", "Distributor"),
  col("explicit", "Explicit?"),
  col("waterfall_release", "Waterfall Release?"),
  col("main_genre", "Main Genre"),
  col("sub_genre", "Sub Genre"),
  col("secondary_genre", "Secondary Genre"),
  col("secondary_sub_genre", "Secondary Sub Genre"),
  col("tracklist", "Tracklist"),
  col("submitters_email", "Submitter's Email"),
  col("date_added", "Date Added", "notion-date"),
  col("creation_date", "Creation Date", "notion-date"),
  col("pre_order_date", "Pre-Order Date", "notion-date"),
  col("recording_date", "Recording Date", "notion-date"),
  col("recording_date_1", "Recording Date (1)", "notion-date"),
  col("socials_release_date", "Social's Release Date", "notion-date"),
  col("assets_due_date", "Assets Due Date", "notion-date"),
  col("premiere_page_release_date", "Premiere Page Release Date", "notion-date"),
  col("premiere_page_release_time", "Premiere Page Release Time"),
  col("time", "Time"),
  col("missing_assets", "Missing Assets", "notion-formula"),
  col("ar_admin_clearance", "A&R Admin Clearance", "check"),
  col("master_audio_file", "Master Audio File ✓", "check"),
  col("cover_art", "Cover Art ✓", "check"),
  col("lyrics", "Lyrics ✓", "check"),
  col("dolby_atmos_mixs", "Dolby Atmos Mix(s) ✓", "check"),
  col("apple_motion_art_2", "Apple Motion Art ✓", "check"),
  col("music_video_file", "Music Video File ✓", "check"),
  col("thumbnail", "Thumbnail ✓", "check"),
  col("video_description", "Video Description ✓", "check"),
  col("keywords_2", "Keywords ✓", "check"),
  col("product_label_copy", "Product Label Copy ✓", "check"),
  col("audio_files_link", "Audio File(s) Link", "url"),
  col("dolby_atmos_mixs_2", "Dolby Atmos Mix(s)", "url"),
  col("apple_motion_art", "Apple Motion Art", "url"),
  col("video_link", "Video Link", "url"),
  col("video_dsps", "Video DSPs", "tags"),
  col("is_this_video_18", "Is this video 18+?", "tags"),
  col("video_description_2", "Video Description"),
  col("keywords", "Keywords"),
  col("disco_listening_link", "DISCO Listening Link", "url"),
  col("disco_download_link", "DISCO Download Link", "url"),
  col("embed_code", "Embed Code"),
  col("upc", "UPC"),
  col("catalog", "Catalog #"),
  col("isrc", "ISRC"),
  col("iswc", "ISWC"),
  col("chartmetric_url", "Chartmetric URL", "url"),
  col("spotify", "Spotify", "url"),
  col("apple", "Apple", "url"),
  col("soundcloud", "Soundcloud", "url"),
  col("you_tube", "YouTube", "url"),
  col("deezer", "Deezer", "url"),
  col("tik_tok", "TikTok", "url"),
  col("amazon", "Amazon", "url"),
  col("pandora", "Pandora", "url"),
  col("shazam", "Shazam", "url"),
  col("foundee", "Found.ee"),
  col("musixmatch", "Musixmatch", "check"),
  col("writers_splits", "Writer(s)/Splits"),
  col("publisher_information", "Publisher Information"),
  col("producers_other_credits", "Producers/Other Credits"),
  col("ah_writers_splits", "AH Writer(s) & Splits"),
  col("ah_writers_pub_info", "AH Writer(s) Pub Info"),
  col("tp_writers_splits", "TP Writer(s) & Splits"),
  col("tp_writers_pub_info", "TP Writer(s) Pub Info"),
  col("alts_stems", "Alts/Stems", "tags"),
  col("contains_sample", "Contains Sample"),
  col("sample_title_writers", "Sample Title & Writers"),
  col("curve", "Curve", "check"),
  col("curve_date_submitted", "Curve Date Submitted", "notion-date"),
  col("disco", "DISCO", "check"),
  col("disco_date_submitted", "DISCO Date Submitted", "notion-date"),
  col("mlc", "MLC", "check"),
  col("mlc_date_submitted", "MLC Date Submitted", "notion-date"),
  col("musicmark", "Musicmark", "check"),
  col("musicmark_date_submitted", "Musicmark Date Submitted", "notion-date"),
  col("ascap", "ASCAP", "check"),
  col("ascap_date_submitted", "ASCAP Date Submitted", "notion-date"),
  col("bmi", "BMI", "check"),
  col("bmi_date_submitted", "BMI Date Submitted", "notion-date"),
  col("cmrra", "CMRRA", "check"),
  col("cmrra_date_submitted", "CMRRA Date Submitted", "notion-date"),
  col("socan", "SOCAN", "check"),
  col("socan_date_submitted", "SOCAN Date Submitted", "notion-date"),
  col("prs", "PRS", "check"),
  col("prs_date_submitted", "PRS Date Submitted", "notion-date"),
  col("kobalt", "Kobalt", "check"),
  col("kobalt_date_submitted", "Kobalt Date Submitted", "notion-date"),
  col("spirit", "Spirit", "check"),
  col("spirit_date_submitted", "Spirit Date Submitted", "notion-date"),
  col("regard", "Regard", "check"),
  col("regard_date_submitted", "Regard Date Submitted", "notion-date"),
  col("spotify_pub", "Spotify (Pub)", "check"),
  col("spotify_date_submitted", "Spotify Date Submitted", "notion-date"),
  col("umpg", "UMPG", "check"),
  col("umpg_date_submitted", "UMPG Date Submitted", "notion-date"),
  col("music_reports", "Music Reports", "check"),
  col("music_reports_submitted", "Music Reports Submitted", "notion-date"),
  col("music_admin", "Music Admin", "check"),
  col("music_admin_submitted", "Music Admin Submitted", "notion-date"),
  col("merlin_transfer_reversion_date", "Merlin Transfer Reversion Date", "notion-formula"),
  col("pre_merlin_reversion_date", "Pre-Merlin Reversion Date", "notion-formula"),
  col("re_pitch", "Re-Pitch", "check"),
  col("yes_yes_yes", "Yes Yes Yes", "check"),
  col("nmd_order", "NMD Order"),
  col("nmd_audience", "NMD Audience", "tags"),
  col("nmd_genre_1", "NMD Genre 1"),
  col("nmd_genre_2", "NMD Genre 2"),
  col("label_copy", "Label Copy"),
  col("marketing_copy", "Marketing Copy"),
  col("key_stats", "Key Stats"),
  col("key_posts", "Key Posts"),
  col("tour_dates", "Tour Dates"),
  col("recent_press", "Recent Press"),
  col("email_bullets", "Email Bullets"),
  col("apple_highlights", "Apple Highlights"),
  col("spotify_highlights", "Spotify Highlights"),
  col("release_highlights", "Release Highlights", "relation"),
  col("release_highlights_1", "Release Highlights 1", "relation"),
  col("artist", "Artist", "relation"),
  col("projects", "Projects", "relation"),
  col("notes", "Notes"),
  col("notion_created_time", "Created (Notion)", "date"),
  col("notion_last_edited_time", "Last Edited (Notion)", "date")
];

const VIDEO_KIND_FILTER = { col: "video_release_submission", op: "notEmpty" };
const PUBLISHING_KIND_FILTER = { col: "publishing_release_submission", op: "notEmpty" };
const AUDIO_KIND_FILTERS = [
  { col: "video_release_submission", op: "empty" },
  { col: "publishing_release_submission", op: "empty" }
];

export const ADMIN_VIEWS = {
  upcoming: {
    label: "Upcoming Releases",
    filters: [
      { col: RELEASE_DATE_START, op: "gt", value: todayInAdminTimezone },
      { col: "status", op: "in", value: ACTIVE_STATUSES }
    ],
    columns: UPCOMING_COLUMNS,
    sort: { col: RELEASE_DATE_START, dir: "asc" }
  },
  audio: {
    label: "Audio Releases",
    filters: AUDIO_KIND_FILTERS,
    columns: AUDIO_COLUMNS,
    sort: { col: RELEASE_DATE_START, dir: "desc" }
  },
  video: {
    label: "Video Release Submission",
    filters: [VIDEO_KIND_FILTER],
    columns: VIDEO_COLUMNS,
    sort: { col: RELEASE_DATE_START, dir: "desc" }
  },
  publishing_submissions: {
    label: "Publishing Submission",
    filters: [PUBLISHING_KIND_FILTER],
    columns: PUBLISHING_SUBMISSION_COLUMNS,
    sort: { col: RELEASE_DATE_START, dir: "desc" }
  },
  tbd: {
    label: "TBD Releases",
    filters: [{ col: "release_date", op: "is", value: null }],
    columns: TBD_COLUMNS,
    sort: { col: "release_title", dir: "asc" }
  },
  all: {
    label: "All Releases",
    filters: [
      { col: "status", op: "neq", value: "Not started" },
      { col: RELEASE_DATE_START, op: "lte", value: todayInAdminTimezone }
    ],
    columns: BASE_COLUMNS,
    sort: { col: RELEASE_DATE_START, dir: "desc" }
  },
  chartmetric: {
    label: "Chartmetric",
    filters: [
      { col: "status", op: "eq", value: "Delivered" },
      { col: RELEASE_DATE_START, op: "lte", value: todayInAdminTimezone },
      { col: "product_version", op: "overlaps", value: ["All DSPs (Main)", "Clean Version"] },
      { col: "tags", op: "overlaps", value: ["Label", "Distribution Only"] }
    ],
    columns: CHARTMETRIC_COLUMNS,
    sort: { col: RELEASE_DATE_START, dir: "desc" }
  },
  management: {
    label: "Management",
    filters: [
      { col: "tags", op: "contains", value: ["Management"] },
      { col: "status", op: "not.in", value: TAKEN_DOWN_STATUSES }
    ],
    columns: BASE_COLUMNS,
    sort: { col: RELEASE_DATE_START, dir: "desc" }
  },
  publishing: {
    label: "Publishing",
    filters: [{ col: "publishing_tag", op: "eq", value: "Publishing" }],
    columns: PUBLISHING_VIEW_COLUMNS,
    sort: { col: RELEASE_DATE_START, dir: "desc" }
  },
  updates: {
    label: "Updates",
    filters: [
      { col: RELEASE_DATE_START, op: "gte", value: monthAgoInAdminTimezone },
      { col: "status", op: "in", value: ["Scheduled", "Delivered"] }
    ],
    columns: ASSET_CHECKLIST_COLUMNS,
    sort: { col: RELEASE_DATE_START, dir: "asc" }
  },
  nmf: {
    label: "New Music Friday",
    // PROVISIONAL: mirrors the upcoming-Friday convention; confirm exact filters.
    filters: [
      { col: RELEASE_DATE_START, op: "eq", value: nextFridayInAdminTimezone },
      { col: "status", op: "in", value: ACTIVE_STATUSES }
    ],
    columns: BASE_COLUMNS,
    sort: { col: "release_title", dir: "asc" }
  },
  entire: {
    label: "Entire Database",
    filters: [],
    columns: ENTIRE_DB_COLUMNS,
    sort: { col: RELEASE_DATE_START, dir: "desc" }
  },
  calendar: {
    label: "Calendar",
    hidden: true,
    filters: [{ col: "release_date", op: "not.is", value: null }],
    columns: BASE_COLUMNS,
    sort: { col: RELEASE_DATE_START, dir: "asc" }
  }
};

export const DEFAULT_ADMIN_VIEW = "upcoming";

export function getAdminView(viewKey) {
  return ADMIN_VIEWS[viewKey] || ADMIN_VIEWS[DEFAULT_ADMIN_VIEW];
}
