import { z } from "zod";

const nonEmpty = z.string().trim().min(1);
const optionalTrimmed = z.string().trim().optional().or(z.literal(""));

export const releasePayloadSchema = z
  .object({
    pageId: optionalTrimmed,
    releaseType: z.enum(["album", "single"]),
    title: nonEmpty,
    labelName: optionalTrimmed,
    mainArtists: nonEmpty,
    pLine: nonEmpty,
    featuredArtists: optionalTrimmed,
    releaseVersion: optionalTrimmed,
    tracklist: optionalTrimmed,
    explicit: z.enum(["Non-Explicit", "Explicit"]),
    dealTags: z.array(z.string()).optional().default([]),
    distributor: optionalTrimmed,
    mainGenre: nonEmpty,
    subGenre: optionalTrimmed,
    secondaryGenre: optionalTrimmed,
    secondarySubGenre: optionalTrimmed,
    releaseDate: nonEmpty,
    preorderDate: optionalTrimmed,
    recordingDate: optionalTrimmed,
    socialReleaseDate: optionalTrimmed,
    audioFileLink: optionalTrimmed,
    lyricsUrl: optionalTrimmed,
    coverArtUrl: optionalTrimmed,
    dolbyAtmosLink: optionalTrimmed,
    appleMotionArtLink: optionalTrimmed,
    waterfallRelease: z.string().trim(),
    waterfallTracklist: optionalTrimmed,
    writersSplits: optionalTrimmed,
    publisherInformation: optionalTrimmed,
    producerCredits: optionalTrimmed,
    notes: optionalTrimmed
  })
  .superRefine((data, ctx) => {
    if (data.releaseType === "album" && !data.tracklist.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tracklist"],
        message: "Tracklist is required for Album / EP submissions."
      });
    }

    if (data.releaseType === "single" && data.waterfallRelease === "Yes" && !data.waterfallTracklist.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["waterfallTracklist"],
        message: "Please provide the waterfall track order."
      });
    }

    if (data.releaseType === "single" && !["Yes", "No"].includes(data.waterfallRelease)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["waterfallRelease"],
        message: "Please select whether this is a waterfall release."
      });
    }
  });

export const publishingPayloadSchema = z.object({
  pageId: optionalTrimmed,
  title: nonEmpty,
  releaseVersion: optionalTrimmed,
  mainArtists: nonEmpty,
  featuredArtists: optionalTrimmed,
  labelInfo: optionalTrimmed,
  altsStems: z.array(z.string()).optional().default([]),
  releaseDate: optionalTrimmed,
  creationDate: optionalTrimmed,
  audioFileLink: optionalTrimmed,
  lyricsUrl: optionalTrimmed,
  coverArtUrl: optionalTrimmed,
  ahWritersSplits: optionalTrimmed,
  tpWritersSplits: optionalTrimmed,
  ahWritersPubInfo: optionalTrimmed,
  tpWritersPubInfo: optionalTrimmed,
  dealType: z.array(z.string()).optional().default([]),
  isrc: optionalTrimmed,
  containsSample: optionalTrimmed,
  sampleTitleWriters: optionalTrimmed,
  notes: optionalTrimmed
});

export const videoPayloadSchema = z.object({
  pageId: optionalTrimmed,
  title: nonEmpty,
  mainArtists: nonEmpty,
  featuredArtists: optionalTrimmed,
  productVersions: z.array(z.string()).optional().default([]),
  distributor: optionalTrimmed,
  videoLink: optionalTrimmed,
  videoDsps: z.array(z.string()).optional().default([]),
  releaseDate: optionalTrimmed,
  releaseTime: optionalTrimmed,
  premiereDate: optionalTrimmed,
  premiereTime: optionalTrimmed,
  adultContent: optionalTrimmed,
  videoDescription: optionalTrimmed,
  keywords: optionalTrimmed,
  notes: optionalTrimmed
});

// --- Admin (internal portal) schemas -----------------------------------------
// Same shapes as the public payloads, but with required-field rules relaxed and
// the workflow fields (status / NMD status / product version) editable.

const workflowFields = {
  status: optionalTrimmed,
  nmdStatus: optionalTrimmed,
  productVersion: optionalTrimmed
};

export const adminAudioPayloadSchema = z.object({
  releaseType: z.enum(["album", "single"]),
  title: nonEmpty,
  labelName: optionalTrimmed,
  mainArtists: optionalTrimmed,
  pLine: optionalTrimmed,
  featuredArtists: optionalTrimmed,
  releaseVersion: optionalTrimmed,
  tracklist: optionalTrimmed,
  explicit: z.enum(["Non-Explicit", "Explicit"]).optional().default("Non-Explicit"),
  dealTags: z.array(z.string()).optional().default([]),
  distributor: optionalTrimmed,
  mainGenre: optionalTrimmed,
  subGenre: optionalTrimmed,
  secondaryGenre: optionalTrimmed,
  secondarySubGenre: optionalTrimmed,
  releaseDate: optionalTrimmed,
  preorderDate: optionalTrimmed,
  recordingDate: optionalTrimmed,
  socialReleaseDate: optionalTrimmed,
  audioFileLink: optionalTrimmed,
  lyricsUrl: optionalTrimmed,
  coverArtUrl: optionalTrimmed,
  dolbyAtmosLink: optionalTrimmed,
  appleMotionArtLink: optionalTrimmed,
  waterfallRelease: optionalTrimmed,
  waterfallTracklist: optionalTrimmed,
  writersSplits: optionalTrimmed,
  publisherInformation: optionalTrimmed,
  producerCredits: optionalTrimmed,
  notes: optionalTrimmed,
  ...workflowFields
});

export const adminVideoPayloadSchema = z.object({
  title: nonEmpty,
  mainArtists: optionalTrimmed,
  featuredArtists: optionalTrimmed,
  productVersions: z.array(z.string()).optional().default([]),
  distributor: optionalTrimmed,
  videoLink: optionalTrimmed,
  videoDsps: z.array(z.string()).optional().default([]),
  releaseDate: optionalTrimmed,
  releaseTime: optionalTrimmed,
  premiereDate: optionalTrimmed,
  premiereTime: optionalTrimmed,
  adultContent: optionalTrimmed,
  videoDescription: optionalTrimmed,
  keywords: optionalTrimmed,
  notes: optionalTrimmed,
  ...workflowFields
});

export const adminPublishingPayloadSchema = z.object({
  title: nonEmpty,
  releaseVersion: optionalTrimmed,
  mainArtists: optionalTrimmed,
  featuredArtists: optionalTrimmed,
  labelInfo: optionalTrimmed,
  altsStems: z.array(z.string()).optional().default([]),
  releaseDate: optionalTrimmed,
  creationDate: optionalTrimmed,
  audioFileLink: optionalTrimmed,
  lyricsUrl: optionalTrimmed,
  coverArtUrl: optionalTrimmed,
  ahWritersSplits: optionalTrimmed,
  tpWritersSplits: optionalTrimmed,
  ahWritersPubInfo: optionalTrimmed,
  tpWritersPubInfo: optionalTrimmed,
  dealType: z.array(z.string()).optional().default([]),
  isrc: optionalTrimmed,
  containsSample: optionalTrimmed,
  sampleTitleWriters: optionalTrimmed,
  notes: optionalTrimmed,
  ...workflowFields
});

export function splitTrackLines(value) {
  return value
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
}
