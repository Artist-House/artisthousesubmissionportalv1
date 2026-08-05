// Declarative definitions of the internal release-schedule views, verified
// against the live Supabase "unified" table (2026-08-05). Each view is a set
// of filters + the columns that apply to it; lib/supabase-releases.js
// translates them into PostgREST queries and the admin table renders whatever
// columns a view declares.
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

const BASE_COLUMNS = [
  { key: "release_title", label: "Title", render: "link" },
  { key: "display_artist", label: "Artist", render: "text" },
  { key: "release_date", label: "Release Date", render: "notion-date" },
  { key: "status", label: "Status", render: "badge" },
  { key: "distribution", label: "Distribution", render: "tags" },
  { key: "tags", label: "Tags", render: "tags" }
];

const AUDIO_COLUMNS = [
  { key: "release_title", label: "Title", render: "link" },
  { key: "display_artist", label: "Artist", render: "text" },
  { key: "type_of_release_audio", label: "Type", render: "text" },
  { key: "label_name", label: "Label", render: "text" },
  { key: "release_date", label: "Release Date", render: "notion-date" },
  { key: "status", label: "Status", render: "badge" },
  { key: "product_version", label: "Product Version", render: "tags" },
  { key: "distribution", label: "Distribution", render: "tags" },
  { key: "explicit", label: "Explicit", render: "text" },
  { key: "main_genre", label: "Genre", render: "text" }
];

const VIDEO_COLUMNS = [
  { key: "release_title", label: "Title", render: "link" },
  { key: "display_artist", label: "Artist", render: "text" },
  { key: "product_version", label: "Applies To", render: "tags" },
  { key: "release_date", label: "Release Date", render: "notion-date" },
  { key: "status", label: "Status", render: "badge" },
  { key: "video_link", label: "Video Link", render: "text" },
  { key: "label_name", label: "Label", render: "text" }
];

const PUBLISHING_COLUMNS = [
  { key: "release_title", label: "Title", render: "link" },
  { key: "display_artist", label: "Artist", render: "text" },
  { key: "writers_splits", label: "Writer(s)/Splits", render: "text" },
  { key: "publisher_information", label: "Publisher", render: "text" },
  { key: "release_date", label: "Release Date", render: "notion-date" },
  { key: "status", label: "Status", render: "badge" }
];

const ASSET_CHECKLIST_COLUMNS = [
  { key: "release_title", label: "Title", render: "link" },
  { key: "display_artist", label: "Artist", render: "text" },
  { key: "release_date", label: "Release Date", render: "notion-date" },
  { key: "status", label: "Status", render: "badge" },
  { key: "cover_art", label: "Cover Art", render: "check" },
  { key: "lyrics", label: "Lyrics", render: "check" },
  { key: "master_audio_file", label: "Audio", render: "check" },
  { key: "dolby_atmos_mixs", label: "Dolby Atmos", render: "check" },
  { key: "apple_motion_art_2", label: "Motion Art", render: "check" },
  { key: "music_video_file", label: "Video", render: "check" }
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
    columns: BASE_COLUMNS,
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
    columns: PUBLISHING_COLUMNS,
    sort: { col: RELEASE_DATE_START, dir: "desc" }
  },
  tbd: {
    label: "TBD Releases",
    filters: [{ col: "release_date", op: "is", value: null }],
    columns: BASE_COLUMNS,
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
    columns: [
      ...BASE_COLUMNS,
      { key: "chartmetric_url", label: "Chartmetric URL", render: "text" }
    ],
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
    columns: BASE_COLUMNS,
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
  merlin: {
    label: "Merlin Transfer",
    // PROVISIONAL: FUGA-distributed releases that are out; confirm exact filters.
    filters: [
      { col: "distribution", op: "contains", value: ["FUGA"] },
      { col: "status", op: "in", value: ["Delivered", "Distributed", "Released"] }
    ],
    columns: [
      ...BASE_COLUMNS,
      { key: "merlin_transfer_reversion_date", label: "Merlin Reversion", render: "notion-formula" }
    ],
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
