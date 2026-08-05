export const RELEASE_TYPES = {
  album: "Album / EP",
  single: "Single"
};

export const STEP_DEFINITIONS = [
  {
    id: "song",
    label: "Song Information",
    description: "Enter the release metadata exactly as it should appear on streaming services."
  },
  {
    id: "timeline",
    label: "Genre and Release Timeline",
    description: "Add the genre metadata and the key calendar dates for launch coordination."
  },
  {
    id: "assets",
    label: "Assets",
    description: "Provide the delivery links and required files for packaging the release."
  },
  {
    id: "publishing",
    label: "Credits",
    description: "Complete the writer splits, credits, and any final team notes."
  }
];

export const GENRE_OPTIONS = [
  "Alternative",
  "Audiobooks",
  "Blues",
  "Children's Music",
  "Classical",
  "Comedy",
  "Country",
  "Dance",
  "Electronic",
  "Folk",
  "Hip Hop/Rap",
  "Holiday",
  "Inspirational",
  "Jazz",
  "Latin",
  "New Age",
  "Opera",
  "Pop",
  "R&B/Soul",
  "Reggae",
  "Rock",
  "Soundtrack",
  "Spoken Word",
  "Vocal",
  "World"
];

export const DEAL_TAG_OPTIONS = ["Label", "Management", "Distribution Only"];
export const EXPLICIT_OPTIONS = ["Non-Explicit", "Explicit"];
export const WATERFALL_OPTIONS = ["Yes", "No"];
export const DISTRIBUTOR_OPTIONS = [
  "Amuse",
  "AWAL",
  "CD Baby",
  "Concord",
  "Distrokid",
  "FUGA",
  "Interscope",
  "Platoon",
  "SoundOn",
  "Tunecore",
  "Warner"
];

// Values below match the live Notion/Supabase vocabulary exactly (verified
// against the unified table on 2026-08-05) — Notion status options are
// case-sensitive, so keep the exact casing.
export const STATUS_OPTIONS = [
  "Not started",
  "Scheduled",
  "In progress",
  "Delivered",
  "Released",
  "Released (Manually)",
  "Distributed",
  "Draft",
  "External",
  "Error",
  "Taken Down",
  "Taken Down (Manually)"
];

export const PRODUCT_VERSION_OPTIONS = [
  "All DSPs (Main)",
  "Clean Version",
  "Apple Music",
  "Spotify",
  "SoundCloud",
  "Audiomack",
  "Beatport",
  "Beatsource",
  "Physical",
  "PROMO ONLY",
  "Single Track Only",
  "Socials Only",
  "UGC Claiming"
];

// The video form's "Please select what applies to this release" dropdown maps
// to the Product Version property; these are its video-specific options.
export const VIDEO_APPLIES_OPTIONS = [
  "Official Music Video",
  "Official Lyric Video",
  "Official Visualizer",
  "Official Audio",
  "Live Performance",
  "FUGA Video"
];

const DISTRIBUTOR_ALIASES = {
  distrokid: "Distrokid",
  "distro kid": "Distrokid",
  cdbaby: "CD Baby",
  "cd baby": "CD Baby",
  soundon: "SoundOn",
  "sound on": "SoundOn",
  tunecore: "Tunecore",
  "tune core": "Tunecore"
};

function normalizeDistributorKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeDistributor(value) {
  const key = normalizeDistributorKey(value);

  if (!key) {
    return "";
  }

  const canonical = DISTRIBUTOR_OPTIONS.find(
    (option) => normalizeDistributorKey(option) === key
  );

  if (canonical) {
    return canonical;
  }

  if (DISTRIBUTOR_ALIASES[key]) {
    return DISTRIBUTOR_ALIASES[key];
  }

  const collapsed = key.replace(/[^a-z0-9]/g, "");
  const fuzzy = DISTRIBUTOR_OPTIONS.find(
    (option) => normalizeDistributorKey(option).replace(/[^a-z0-9]/g, "") === collapsed
  );

  return fuzzy || String(value).trim();
}

export const MARKETING_SECTIONS = [
  {
    id: "about",
    title: "About",
    body:
      "Artist House brings label, management, and publishing into one editorial-minded operating system for the next generation of artists. This portal extends that same environment into release operations with a cleaner handoff between creators and the internal team."
  },
  {
    id: "label",
    title: "Label",
    body:
      "The label team uses this intake to lock release metadata, align assets, and schedule delivery with the right release framing from the start. Every field is designed to capture the version that should travel intact through distribution."
  },
  {
    id: "publishing",
    title: "Publishing",
    body:
      "Publishing details are collected alongside release details so splits, publishers, and producer credits arrive together. The goal is fewer follow-ups, less friction, and cleaner metadata before anything goes live."
  },
  {
    id: "studio",
    title: "Studio",
    body:
      "Built under the Artist House studio roof in New York, the portal is meant to feel operational rather than ornamental: direct inputs, exact stylization, and a submission flow that supports real release work."
  },
  {
    id: "management",
    title: "Management",
    body:
      "Management visibility is part of the release intake from day one. Deal tags, timelines, social dates, and notes travel into the same schedule so Artist House teams stay aligned without duplicate entry."
  }
];

export const INITIAL_FORM_VALUES = {
  submitterEmail: "",
  title: "",
  labelName: "",
  mainArtists: "",
  pLine: "",
  featuredArtists: "",
  releaseVersion: "",
  tracklist: "",
  explicit: "Non-Explicit",
  dealTags: [],
  distributor: "",
  mainGenre: "",
  subGenre: "",
  secondaryGenre: "",
  secondarySubGenre: "",
  releaseDate: "",
  preorderDate: "",
  recordingDate: "",
  socialReleaseDate: "",
  audioFileLink: "",
  lyricsUrl: "",
  coverArtUrl: "",
  dolbyAtmosLink: "",
  appleMotionArtLink: "",
  waterfallRelease: "",
  waterfallTracklist: "",
  writersSplits: "",
  publisherInformation: "",
  producerCredits: "",
  notes: ""
};
