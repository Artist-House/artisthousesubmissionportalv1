// Shared (client + server) helpers for describing release form fields:
// friendly labels, which fields are still missing, and diffing two submissions.

export const RELEASE_FIELD_LABELS = {
  title: "Title",
  releaseVersion: "Release Version",
  mainArtists: "Main Artist(s)",
  featuredArtists: "Featured Artist(s)",
  pLine: "P-Line",
  tracklist: "Tracklist",
  explicit: "Explicit",
  mainGenre: "Main Genre",
  subGenre: "Sub Genre",
  secondaryGenre: "Secondary Genre",
  secondarySubGenre: "Secondary Sub Genre",
  releaseDate: "Release Date",
  preorderDate: "Preorder Date",
  recordingDate: "Recording Date",
  socialReleaseDate: "Social's Release Date",
  audioFileLink: "Audio File(s) Link",
  lyricsUrl: "Lyrics",
  coverArtUrl: "Cover Art",
  dolbyAtmosLink: "Dolby Atmos Mix Link",
  appleMotionArtLink: "Apple Motion Art Link",
  waterfallRelease: "Waterfall Release",
  waterfallTracklist: "Waterfall Tracklist",
  writersSplits: "Writer(s) and Splits",
  publisherInformation: "Publisher Information",
  producerCredits: "Producer(s) / Other Credits",
  notes: "Notes"
};

function isRelevantField(field, releaseType, formValues) {
  if (field === "tracklist") {
    return releaseType === "album";
  }

  if (field === "releaseVersion" || field === "waterfallRelease") {
    return releaseType === "single";
  }

  if (field === "waterfallTracklist") {
    return releaseType === "single" && formValues.waterfallRelease === "Yes";
  }

  return true;
}

// Fields the team still needs before a release can be delivered. Notes and
// release version are genuinely optional, so they never count as missing.
const MISSING_FIELD_CANDIDATES = [
  "featuredArtists",
  "tracklist",
  "subGenre",
  "secondaryGenre",
  "secondarySubGenre",
  "preorderDate",
  "recordingDate",
  "socialReleaseDate",
  "audioFileLink",
  "lyricsUrl",
  "coverArtUrl",
  "dolbyAtmosLink",
  "appleMotionArtLink",
  "waterfallTracklist",
  "writersSplits",
  "publisherInformation",
  "producerCredits"
];

export function getMissingFields({ releaseType, formValues, existingAssets }) {
  return MISSING_FIELD_CANDIDATES.filter((field) => {
    if (!isRelevantField(field, releaseType, formValues)) {
      return false;
    }

    if (field === "lyricsUrl" && existingAssets?.lyrics) {
      return false;
    }

    if (field === "coverArtUrl" && existingAssets?.coverArt) {
      return false;
    }

    return !String(formValues[field] || "").trim();
  }).map((field) => RELEASE_FIELD_LABELS[field]);
}

export const PUBLISHING_FIELD_LABELS = {
  title: "Title",
  releaseVersion: "Release Version",
  mainArtists: "Main Artist(s)",
  featuredArtists: "Featured Artist(s)",
  labelInfo: "Label Info",
  altsStems: "Alts/Stems",
  releaseDate: "Release Date",
  creationDate: "Creation Date",
  audioFileLink: "Audio File(s) Link",
  lyricsUrl: "Lyrics",
  coverArtUrl: "Cover Art",
  ahWritersSplits: "Artist House Writer(s) & Splits",
  tpWritersSplits: "Third Party Writer(s) & Splits",
  ahWritersPubInfo: "Artist House Writer(s) Publisher Information",
  tpWritersPubInfo: "Third Party Writer(s) Publisher Information",
  dealType: "Deal Type",
  isrc: "ISRC",
  containsSample: "Contains Sample",
  sampleTitleWriters: "Sample Title & Writers",
  notes: "Notes"
};

export const VIDEO_FIELD_LABELS = {
  title: "Title",
  typeOfRelease: "Type of Release",
  mainArtists: "Main Artist(s)",
  featuredArtists: "Featured Artist(s)",
  productVersions: "Applies to This Release",
  distributor: "Distributor",
  videoLink: "Link to Video",
  videoDsps: "Video DSPs",
  releaseDate: "Release Date",
  releaseTime: "Release Time",
  premiereDate: "Premiere Page Release Date",
  premiereTime: "Premiere Page Release Time",
  adultContent: "18+ Video",
  videoDescription: "Video Description",
  keywords: "Keywords",
  notes: "Notes"
};

export const FORM_KIND_LABELS = {
  release: null,
  publishing: "Publishing (Audio)",
  video: "Video"
};

const PUBLISHING_MISSING_CANDIDATES = [
  "releaseDate",
  "creationDate",
  "audioFileLink",
  "lyricsUrl",
  "coverArtUrl",
  "ahWritersSplits",
  "tpWritersSplits",
  "ahWritersPubInfo",
  "tpWritersPubInfo",
  "dealType",
  "isrc"
];

const VIDEO_MISSING_CANDIDATES = [
  "typeOfRelease",
  "videoLink",
  "videoDsps",
  "releaseDate",
  "releaseTime",
  "thumbnail",
  "videoDescription",
  "keywords"
];

function valueIsBlank(value) {
  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return !String(value || "").trim();
}

export function getMissingFieldsForMatch(match) {
  if (match.kind === "publishing") {
    return PUBLISHING_MISSING_CANDIDATES.filter((field) => {
      if (field === "lyricsUrl" && match.existingAssets?.lyrics) {
        return false;
      }

      if (field === "coverArtUrl" && match.existingAssets?.coverArt) {
        return false;
      }

      return valueIsBlank(match.formValues[field]);
    }).map((field) => PUBLISHING_FIELD_LABELS[field]);
  }

  if (match.kind === "video") {
    return VIDEO_MISSING_CANDIDATES.filter((field) => {
      if (field === "thumbnail") {
        return !match.existingAssets?.thumbnail;
      }

      return valueIsBlank(match.formValues[field]);
    }).map((field) => VIDEO_FIELD_LABELS[field] || "Thumbnail");
  }

  return getMissingFields(match);
}

function diffLabeledValues(labels, previousValues, nextPayload, relevance) {
  return Object.keys(labels)
    .filter((field) => (relevance ? relevance(field) : true))
    .map((field) => {
      const beforeRaw = previousValues?.[field];
      const afterRaw = nextPayload[field];
      const before = Array.isArray(beforeRaw) ? beforeRaw.join(", ") : String(beforeRaw || "").trim();
      const after = Array.isArray(afterRaw) ? afterRaw.join(", ") : String(afterRaw || "").trim();

      if (before === after) {
        return null;
      }

      return {
        label: labels[field],
        before,
        after
      };
    })
    .filter(Boolean);
}

export function diffReleaseValues(previousValues, nextPayload) {
  return diffLabeledValues(RELEASE_FIELD_LABELS, previousValues, nextPayload, (field) =>
    isRelevantField(field, nextPayload.releaseType, nextPayload)
  );
}

export function diffPublishingValues(previousValues, nextPayload) {
  return diffLabeledValues(PUBLISHING_FIELD_LABELS, previousValues, nextPayload);
}

export function diffVideoValues(previousValues, nextPayload) {
  return diffLabeledValues(VIDEO_FIELD_LABELS, previousValues, nextPayload);
}
