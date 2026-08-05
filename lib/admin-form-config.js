import {
  DEAL_TAG_OPTIONS,
  DISTRIBUTOR_OPTIONS,
  EXPLICIT_OPTIONS,
  GENRE_OPTIONS,
  PRODUCT_VERSION_OPTIONS,
  STATUS_OPTIONS,
  VIDEO_APPLIES_OPTIONS,
  WATERFALL_OPTIONS
} from "@/lib/release-config";

// Field definitions that drive the admin detail/create forms. Each field is
// { key, label, input, options?, section }. The form component renders whatever
// the active kind declares — video intentionally has no free-text
// "Type of release" field, only the "Please select what applies" dropdown.

const WORKFLOW_SECTION = "Workflow";
const RELEASE_SECTION = "Release";
const TIMELINE_SECTION = "Timeline";
const ASSETS_SECTION = "Assets";
const CREDITS_SECTION = "Credits";

const WORKFLOW_FIELDS = [
  { key: "status", label: "Status", input: "select", options: STATUS_OPTIONS, section: WORKFLOW_SECTION },
  { key: "productVersion", label: "Product Version", input: "select", options: PRODUCT_VERSION_OPTIONS, section: WORKFLOW_SECTION },
  { key: "dealTags", label: "Tags", input: "multiselect", options: DEAL_TAG_OPTIONS, section: WORKFLOW_SECTION },
  { key: "distributor", label: "Distribution", input: "select-or-text", options: DISTRIBUTOR_OPTIONS, section: WORKFLOW_SECTION }
];

export const AUDIO_FIELDS = [
  ...WORKFLOW_FIELDS,
  { key: "releaseType", label: "Type of Release", input: "select", options: ["album", "single"], optionLabels: { album: "Album / EP", single: "Single" }, section: RELEASE_SECTION },
  { key: "title", label: "Release Title", input: "text", section: RELEASE_SECTION, required: true },
  { key: "mainArtists", label: "Display Artist", input: "text", section: RELEASE_SECTION },
  { key: "featuredArtists", label: "Featured Artist(s)", input: "text", section: RELEASE_SECTION },
  { key: "labelName", label: "Label Name", input: "text", section: RELEASE_SECTION },
  { key: "pLine", label: "P-Line", input: "text", section: RELEASE_SECTION },
  { key: "releaseVersion", label: "Release Version", input: "text", section: RELEASE_SECTION },
  { key: "explicit", label: "Explicit?", input: "select", options: EXPLICIT_OPTIONS, section: RELEASE_SECTION },
  { key: "waterfallRelease", label: "Waterfall Release?", input: "select", options: WATERFALL_OPTIONS, section: RELEASE_SECTION },
  { key: "tracklist", label: "Tracklist", input: "textarea", section: RELEASE_SECTION },
  { key: "mainGenre", label: "Main Genre", input: "select-or-text", options: GENRE_OPTIONS, section: TIMELINE_SECTION },
  { key: "subGenre", label: "Sub Genre", input: "select-or-text", options: GENRE_OPTIONS, section: TIMELINE_SECTION },
  { key: "secondaryGenre", label: "Secondary Genre", input: "select-or-text", options: GENRE_OPTIONS, section: TIMELINE_SECTION },
  { key: "secondarySubGenre", label: "Secondary Sub Genre", input: "select-or-text", options: GENRE_OPTIONS, section: TIMELINE_SECTION },
  { key: "releaseDate", label: "Release Date", input: "date", section: TIMELINE_SECTION },
  { key: "preorderDate", label: "Pre-Order Date", input: "date", section: TIMELINE_SECTION },
  { key: "recordingDate", label: "Recording Date", input: "date", section: TIMELINE_SECTION },
  { key: "socialReleaseDate", label: "Social's Release Date", input: "date", section: TIMELINE_SECTION },
  { key: "audioFileLink", label: "Audio File(s) Link", input: "url", section: ASSETS_SECTION },
  { key: "lyricsUrl", label: "Lyrics URL", input: "url", section: ASSETS_SECTION },
  { key: "coverArtUrl", label: "Cover Art URL", input: "url", section: ASSETS_SECTION },
  { key: "dolbyAtmosLink", label: "Dolby Atmos Mix(s)", input: "url", section: ASSETS_SECTION },
  { key: "appleMotionArtLink", label: "Apple Motion Art", input: "url", section: ASSETS_SECTION },
  { key: "writersSplits", label: "Writer(s)/Splits", input: "textarea", section: CREDITS_SECTION },
  { key: "publisherInformation", label: "Publisher Information", input: "textarea", section: CREDITS_SECTION },
  { key: "producerCredits", label: "Producers/Other Credits", input: "textarea", section: CREDITS_SECTION },
  { key: "notes", label: "Notes", input: "textarea", section: CREDITS_SECTION }
];

export const VIDEO_FIELDS = [
  { key: "status", label: "Status", input: "select", options: STATUS_OPTIONS, section: WORKFLOW_SECTION },
  { key: "title", label: "Release Title", input: "text", section: RELEASE_SECTION, required: true },
  { key: "mainArtists", label: "Display Artist", input: "text", section: RELEASE_SECTION },
  { key: "labelName", label: "Label Name", input: "text", section: RELEASE_SECTION },
  { key: "videoApplies", label: "Please select what applies to this release", input: "multiselect", options: VIDEO_APPLIES_OPTIONS, section: RELEASE_SECTION },
  { key: "videoLink", label: "Video Link", input: "url", section: ASSETS_SECTION },
  { key: "releaseDate", label: "Release Date", input: "date", section: TIMELINE_SECTION },
  { key: "socialReleaseDate", label: "Social's Release Date", input: "date", section: TIMELINE_SECTION },
  { key: "notes", label: "Notes", input: "textarea", section: CREDITS_SECTION }
];

export const PUBLISHING_FIELDS = [
  { key: "status", label: "Status", input: "select", options: STATUS_OPTIONS, section: WORKFLOW_SECTION },
  { key: "title", label: "Release Title", input: "text", section: RELEASE_SECTION, required: true },
  { key: "mainArtists", label: "Display Artist", input: "text", section: RELEASE_SECTION },
  { key: "labelName", label: "Label Name", input: "text", section: RELEASE_SECTION },
  { key: "writersSplits", label: "Writer(s)/Splits", input: "textarea", section: CREDITS_SECTION },
  { key: "publisherInformation", label: "Publisher Information", input: "textarea", section: CREDITS_SECTION },
  { key: "producerCredits", label: "Producers/Other Credits", input: "textarea", section: CREDITS_SECTION },
  { key: "releaseDate", label: "Release Date", input: "date", section: TIMELINE_SECTION },
  { key: "notes", label: "Notes", input: "textarea", section: CREDITS_SECTION }
];

export const FIELDS_BY_KIND = {
  audio: AUDIO_FIELDS,
  video: VIDEO_FIELDS,
  publishing: PUBLISHING_FIELDS
};

export const KIND_LABELS = {
  audio: "Audio / Distribution",
  video: "Video Release",
  publishing: "Publishing"
};

function notionDateToInput(value) {
  return String(value?.start || "").slice(0, 10);
}

// Supabase unified row (verified live schema) -> admin form values
// (camelCase payload keys). Dates are jsonb { start, end, time_zone }.
export function buildFormValuesFromUnifiedRow(row) {
  const releaseType = /single/i.test(row?.type_of_release_audio || "") ? "single" : "album";
  const productVersions = Array.isArray(row?.product_version) ? row.product_version : [];

  return {
    releaseType,
    title: row?.release_title || "",
    labelName: row?.label_name || "",
    mainArtists: row?.display_artist || "",
    pLine: row?.p_line || "",
    featuredArtists: row?.featured_artists || "",
    releaseVersion: row?.release_version || "",
    tracklist: row?.tracklist || "",
    explicit: row?.explicit || "Non-Explicit",
    dealTags: Array.isArray(row?.tags) ? row.tags : [],
    distributor: (Array.isArray(row?.distribution) && row.distribution[0]) || "",
    mainGenre: row?.main_genre || "",
    subGenre: row?.sub_genre || "",
    secondaryGenre: row?.secondary_genre || "",
    secondarySubGenre: row?.secondary_sub_genre || "",
    releaseDate: notionDateToInput(row?.release_date),
    preorderDate: notionDateToInput(row?.pre_order_date),
    recordingDate: notionDateToInput(row?.recording_date),
    socialReleaseDate: notionDateToInput(row?.socials_release_date),
    audioFileLink: row?.audio_files_link || "",
    lyricsUrl: "",
    coverArtUrl: "",
    dolbyAtmosLink: row?.dolby_atmos_mixs_2 || "",
    appleMotionArtLink: row?.apple_motion_art || "",
    waterfallRelease: row?.waterfall_release || "",
    waterfallTracklist: "",
    writersSplits: row?.writers_splits || "",
    publisherInformation: row?.publisher_information || "",
    producerCredits: row?.producers_other_credits || "",
    notes: row?.notes || "",
    videoApplies: productVersions,
    videoLink: row?.video_link || "",
    status: row?.status || "",
    nmdStatus: row?.nmd_status || "",
    productVersion: productVersions[0] || ""
  };
}
