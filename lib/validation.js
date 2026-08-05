import { z } from "zod";
import { normalizeDistributor, STATUS_OPTIONS, PRODUCT_VERSION_OPTIONS } from "@/lib/release-config";

const nonEmpty = z.string().trim().min(1);
const optionalTrimmed = z.string().trim().optional().or(z.literal(""));

export const releasePayloadSchema = z
  .object({
    pageId: optionalTrimmed,
    releaseType: z.enum(["album", "single"]),
    title: nonEmpty,
    labelName: nonEmpty,
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

const workflowFields = {
  status: z.enum(STATUS_OPTIONS).optional(),
  nmdStatus: optionalTrimmed,
  productVersion: z.enum(PRODUCT_VERSION_OPTIONS).optional()
};

const normalizedDistributor = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((value) => normalizeDistributor(value || ""));

// Admin edits of audio releases: same shape as the public payload but with the
// workflow fields editable and the public-only cross-field rules relaxed.
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
  distributor: normalizedDistributor,
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

// The video form intentionally has no free-text "Type of release" field —
// only the "Please select what applies to this release" dropdown
// (videoApplies, stored in the unified table's product_version column).
export const videoPayloadSchema = z.object({
  title: nonEmpty,
  mainArtists: optionalTrimmed,
  labelName: optionalTrimmed,
  videoApplies: z.array(z.string()).optional().default([]),
  videoLink: optionalTrimmed,
  releaseDate: optionalTrimmed,
  socialReleaseDate: optionalTrimmed,
  notes: optionalTrimmed,
  ...workflowFields
});

export const publishingPayloadSchema = z.object({
  title: nonEmpty,
  mainArtists: optionalTrimmed,
  labelName: optionalTrimmed,
  writersSplits: optionalTrimmed,
  publisherInformation: optionalTrimmed,
  producerCredits: optionalTrimmed,
  releaseDate: optionalTrimmed,
  notes: optionalTrimmed,
  ...workflowFields
});

export function splitTrackLines(value) {
  return value
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
}
