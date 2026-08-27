import "server-only";

import { Client } from "@notionhq/client";
import { getEnv } from "@/lib/env";
import { splitTrackLines } from "@/lib/validation";

const RELEASE_FIELD_CANDIDATES = {
  releaseTitle: ["Release Title"],
  releaseType: ["Type of Release (Audio)", "Type of Release:", "Type of Release", "Release Type", "Release type"],
  labelName: ["Label Name"],
  submitterEmail: ["Submitter’s Email:"],
  mainArtists: ["Display Artist", "artist"],
  pLine: ["P-Line", "P Line", "P-Line:"],
  featuredArtists: ["Featured Artist(s)"],
  releaseVersion: ["Release Version"],
  productVersion: ["Product Version"],
  tracklist: ["Tracklist"],
  explicit: ["Explicit?"],
  dealTags: ["Tags"],
  distributor: ["Distribution"],
  mainGenre: ["Main Genre"],
  subGenre: ["Sub Genre"],
  secondaryGenre: ["Secondary Genre"],
  secondarySubGenre: ["Secondary Sub Genre"],
  releaseDate: ["Release Date"],
  preorderDate: ["Pre-Order Date"],
  recordingDate: ["Recording Date:", "Recording Date: (1)"],
  socialReleaseDate: ["Social's Release Date"],
  audioFileLink: ["Audio File(s) Link"],
  lyrics: ["Lyrics"],
  coverArt: ["Cover Art"],
  dolbyAtmosLink: ["Dolby Atmos Mix(s)"],
  appleMotionArtLink: ["Apple Motion Art"],
  waterfallRelease: ["Waterfall Release?"],
  writersSplits: ["Writer(s)/Splits"],
  publisherInformation: ["Publisher Information"],
  producerCredits: ["Producers/Other Credits"],
  notes: ["Notes"],
  coverArtComplete: ["Cover Art ✓ "],
  lyricsComplete: ["Lyrics ✓"],
  dolbyAtmosComplete: ["Dolby Atmos Mix(s) ✓"],
  appleMotionArtComplete: ["Apple Motion Art ✓"],
  masterAudioComplete: ["Master Audio File ✓"],
  nmdStatus: ["NMD Status"],
  status: ["Status"],
  publishingTag: ["Publishing Tag"],
  altsStems: ["Alts/Stems"],
  creationDate: ["Creation Date"],
  ahWritersSplits: ["AH Writer(s) & Splits"],
  tpWritersSplits: ["TP Writer(s) & Splits"],
  ahWritersPubInfo: ["AH Writer(s) Pub Info"],
  tpWritersPubInfo: ["TP Writer(s) Pub Info"],
  dealType: ["Deal Type"],
  isrc: ["ISRC"],
  containsSample: ["Contains Sample"],
  sampleTitleWriters: ["Sample Title & Writers"],
  typeOfReleaseVideo: ["Type of Release (Video)"],
  videoDistributor: ["Distributor:"],
  videoLink: ["Video Link"],
  videoDsps: ["Video DSPs"],
  releaseTime: ["Time"],
  premiereDate: ["Premiere Page Release Date:"],
  premiereTime: ["Premiere Page Release Time:"],
  adultContent: ["Is this video 18+?"],
  thumbnail: ["Thumbnail"],
  videoDescription: ["Video Description"],
  keywords: ["Keywords"],
  thumbnailComplete: ["Thumbnail ✓"],
  videoDescriptionComplete: ["Video Description ✓"],
  keywordsComplete: ["Keywords ✓"],
  musicVideoFileComplete: ["Music Video File ✓"]
};

// Fields that may be renamed/removed in Notion without breaking the portal.
const OPTIONAL_FIELD_KEYS = new Set([
  "appleMotionArtComplete",
  "publishingTag",
  "altsStems",
  "creationDate",
  "ahWritersSplits",
  "tpWritersSplits",
  "ahWritersPubInfo",
  "tpWritersPubInfo",
  "dealType",
  "isrc",
  "containsSample",
  "sampleTitleWriters",
  "typeOfReleaseVideo",
  "videoDistributor",
  "videoLink",
  "videoDsps",
  "releaseTime",
  "premiereDate",
  "premiereTime",
  "adultContent",
  "thumbnail",
  "videoDescription",
  "keywords",
  "thumbnailComplete",
  "videoDescriptionComplete",
  "keywordsComplete",
  "musicVideoFileComplete"
]);

let releaseSchemaPromise;
let usersSchemaPromise;

function createNotionClient() {
  const { notionToken } = getEnv();
  return new Client({ auth: notionToken });
}

function getPlainTitle(items = []) {
  return items.map((item) => item.plain_text).join("").trim();
}

function getRichTextValue(property) {
  if (!property) {
    return "";
  }

  if (property.type === "email") {
    return property.email || "";
  }

  if (property.type === "title") {
    return getPlainTitle(property.title);
  }

  if (property.type === "rich_text") {
    return getPlainTitle(property.rich_text);
  }

  return "";
}

function getSelectValue(property) {
  if (!property) {
    return "";
  }

  if (property.type === "select") {
    return property.select?.name || "";
  }

  if (property.type === "status") {
    return property.status?.name || "";
  }

  return "";
}

function getMultiSelectValue(property) {
  if (!property || property.type !== "multi_select") {
    return [];
  }

  return property.multi_select.map((item) => item.name).filter(Boolean);
}

function getDateValue(property) {
  if (!property || property.type !== "date") {
    return "";
  }

  return property.date?.start || "";
}

function getUrlValue(property) {
  if (!property || property.type !== "url") {
    return "";
  }

  return property.url || "";
}

function getFiles(property) {
  if (!property || property.type !== "files") {
    return [];
  }

  return property.files || [];
}

function getReleaseTypeValue(property) {
  const candidates = [
    getRichTextValue(property),
    getSelectValue(property),
    ...(property?.type === "multi_select" ? property.multi_select.map((item) => item.name) : [])
  ]
    .filter(Boolean)
    .map((value) => value.toLowerCase());

  return candidates.find(Boolean) || "";
}

function stripTracklistNumbering(value) {
  return value
    .split("\n")
    .map((line) => line.replace(/^\s*\d+\.\s*/, ""))
    .join("\n")
    .trim();
}

function toRichText(value) {
  if (!value) {
    return [];
  }

  return [
    {
      type: "text",
      text: {
        content: value
      }
    }
  ];
}

function buildNotionFileValue(url, label) {
  if (!url) {
    return null;
  }

  return {
    type: "external",
    name: label,
    external: {
      url
    }
  };
}

function buildNamedPropertyValue(propertySchema, value) {
  if (!propertySchema || !value) {
    return null;
  }

  if (propertySchema.type === "select") {
    return {
      select: { name: value }
    };
  }

  if (propertySchema.type === "multi_select") {
    return {
      multi_select: [{ name: value }]
    };
  }

  if (propertySchema.type === "status") {
    return {
      status: { name: value }
    };
  }

  return {
    rich_text: toRichText(value)
  };
}

function normalizePropertyName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function resolvePropertyName(properties, candidates, required = true) {
  for (const name of candidates) {
    if (properties[name]) {
      return name;
    }
  }

  // Fuzzy fallbacks must never land on a relation property: no candidate list
  // targets one, and writing text into a relation fails the whole submission
  // (e.g. "Display Artist" renamed → the "Artist" relation matched partially).
  const propertyNames = Object.keys(properties).filter(
    (name) => properties[name]?.type !== "relation"
  );
  const normalizedMap = new Map(propertyNames.map((name) => [normalizePropertyName(name), name]));

  for (const candidate of candidates) {
    const normalizedCandidate = normalizePropertyName(candidate);

    if (normalizedMap.has(normalizedCandidate)) {
      return normalizedMap.get(normalizedCandidate);
    }

    const partialMatch = propertyNames.find((name) => {
      const normalizedName = normalizePropertyName(name);
      return normalizedName.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedName);
    });

    if (partialMatch) {
      return partialMatch;
    }
  }

  if (required) {
    throw new Error(`Expected Notion property not found. Tried: ${candidates.join(", ")}`);
  }

  return null;
}

async function getReleaseSchema() {
  if (!releaseSchemaPromise) {
    const notion = createNotionClient();
    const { notionReleaseScheduleDb } = getEnv();
    releaseSchemaPromise = notion.dataSources.retrieve({
      data_source_id: notionReleaseScheduleDb
    });
  }

  return releaseSchemaPromise;
}

async function getUsersSchema() {
  if (!usersSchemaPromise) {
    const notion = createNotionClient();
    const { notionUsersDb } = getEnv();
    usersSchemaPromise = notion.dataSources.retrieve({
      data_source_id: notionUsersDb
    });
  }

  return usersSchemaPromise;
}

function findAllowlistProperty(properties) {
  const entries = Object.entries(properties);

  const emailProperty =
    entries.find(([name, property]) => property.type === "email" && /email/i.test(name)) ||
    entries.find(([name, property]) => property.type === "title" && /name|email/i.test(name)) ||
    entries.find(([name, property]) => property.type === "rich_text" && /email/i.test(name)) ||
    entries.find(([, property]) => property.type === "title");

  if (!emailProperty) {
    throw new Error("Could not find an email-compatible property in the allowlist data source.");
  }

  return emailProperty;
}

function buildAllowlistFilter(propertyName, propertyType, email) {
  if (propertyType === "email") {
    return { property: propertyName, email: { equals: email } };
  }

  if (propertyType === "rich_text") {
    return { property: propertyName, rich_text: { equals: email } };
  }

  return { property: propertyName, title: { equals: email } };
}

async function uploadFileToNotion(notion, file) {
  if (!file || typeof file.name !== "string" || file.size === 0) {
    return null;
  }

  const created = await notion.fileUploads.create({
    mode: "single_part",
    filename: file.name,
    content_type: file.type || "application/octet-stream"
  });

  await notion.fileUploads.send({
    file_upload_id: created.id,
    file: {
      filename: file.name,
      data: file
    }
  });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const uploaded = await notion.fileUploads.retrieve({
      file_upload_id: created.id
    });

    if (uploaded.status === "uploaded") {
      return {
        type: "file_upload",
        file_upload: {
          id: created.id
        },
        name: file.name
      };
    }

    if (uploaded.status === "failed") {
      const message = uploaded.file_import_result?.type === "error" ? uploaded.file_import_result.error.message : "File upload failed in Notion.";
      throw new Error(message);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return {
    type: "file_upload",
    file_upload: {
      id: created.id
    },
    name: file.name
  };
}

function buildResolvedFieldMap(properties) {
  return Object.fromEntries(
    Object.entries(RELEASE_FIELD_CANDIDATES).map(([key, candidates]) => [
      key,
      resolvePropertyName(properties, candidates, !OPTIONAL_FIELD_KEYS.has(key))
    ])
  );
}

function buildReleaseQueryFilter(fields, releaseSchema, title, email) {
  const titleField = releaseSchema.properties[fields.releaseTitle];
  const emailField = releaseSchema.properties[fields.submitterEmail];

  const titleFilter =
    titleField?.type === "title"
      ? { property: fields.releaseTitle, title: { equals: title } }
      : { property: fields.releaseTitle, rich_text: { equals: title } };

  const emailFilter =
    emailField?.type === "email"
      ? { property: fields.submitterEmail, email: { equals: email } }
      : { property: fields.submitterEmail, rich_text: { equals: email } };

  return {
    and: [titleFilter, emailFilter]
  };
}

function getSubmissionKind(page, fields) {
  const publishingTag = fields.publishingTag ? getSelectValue(page.properties[fields.publishingTag]) : "";

  if (publishingTag) {
    return "publishing";
  }

  const videoType = fields.typeOfReleaseVideo ? getRichTextValue(page.properties[fields.typeOfReleaseVideo]) : "";
  const videoLink = fields.videoLink ? getUrlValue(page.properties[fields.videoLink]) : "";

  if (videoType || videoLink) {
    return "video";
  }

  return "release";
}

function buildPublishingFormValuesFromPage(page, fields) {
  const lyricsFiles = getFiles(page.properties[fields.lyrics]);
  const coverArtFiles = getFiles(page.properties[fields.coverArt]);

  return {
    pageId: page.id,
    kind: "publishing",
    releaseType: "single",
    status: getSelectValue(page.properties[fields.status]) || "",
    formValues: {
      title: getRichTextValue(page.properties[fields.releaseTitle]),
      releaseVersion: getRichTextValue(page.properties[fields.releaseVersion]),
      mainArtists: getRichTextValue(page.properties[fields.mainArtists]),
      featuredArtists: getRichTextValue(page.properties[fields.featuredArtists]),
      labelInfo: getRichTextValue(page.properties[fields.labelName]),
      altsStems: fields.altsStems ? getMultiSelectValue(page.properties[fields.altsStems]) : [],
      releaseDate: getDateValue(page.properties[fields.releaseDate]),
      creationDate: fields.creationDate ? getDateValue(page.properties[fields.creationDate]) : "",
      audioFileLink: getUrlValue(page.properties[fields.audioFileLink]),
      lyricsUrl: lyricsFiles.find((file) => file.type === "external")?.external?.url || "",
      coverArtUrl: coverArtFiles.find((file) => file.type === "external")?.external?.url || "",
      ahWritersSplits: fields.ahWritersSplits ? getRichTextValue(page.properties[fields.ahWritersSplits]) : "",
      tpWritersSplits: fields.tpWritersSplits ? getRichTextValue(page.properties[fields.tpWritersSplits]) : "",
      ahWritersPubInfo: fields.ahWritersPubInfo ? getRichTextValue(page.properties[fields.ahWritersPubInfo]) : "",
      tpWritersPubInfo: fields.tpWritersPubInfo ? getRichTextValue(page.properties[fields.tpWritersPubInfo]) : "",
      dealType: fields.dealType ? getMultiSelectValue(page.properties[fields.dealType]) : [],
      isrc: fields.isrc ? getRichTextValue(page.properties[fields.isrc]) : "",
      containsSample: fields.containsSample ? getSelectValue(page.properties[fields.containsSample]) : "",
      sampleTitleWriters: fields.sampleTitleWriters ? getRichTextValue(page.properties[fields.sampleTitleWriters]) : "",
      notes: getRichTextValue(page.properties[fields.notes])
    },
    existingAssets: {
      lyrics: lyricsFiles.length > 0,
      coverArt: coverArtFiles.length > 0
    },
    updatedAt: page.last_edited_time,
    createdAt: page.created_time
  };
}

function buildVideoFormValuesFromPage(page, fields) {
  const thumbnailFiles = fields.thumbnail ? getFiles(page.properties[fields.thumbnail]) : [];

  return {
    pageId: page.id,
    kind: "video",
    releaseType: "single",
    status: getSelectValue(page.properties[fields.status]) || "",
    formValues: {
      title: getRichTextValue(page.properties[fields.releaseTitle]),
      typeOfRelease: fields.typeOfReleaseVideo ? getRichTextValue(page.properties[fields.typeOfReleaseVideo]) : "",
      mainArtists: getRichTextValue(page.properties[fields.mainArtists]),
      featuredArtists: getRichTextValue(page.properties[fields.featuredArtists]),
      productVersions: getMultiSelectValue(page.properties[fields.productVersion]),
      distributor: fields.videoDistributor ? getRichTextValue(page.properties[fields.videoDistributor]) : "",
      videoLink: fields.videoLink ? getUrlValue(page.properties[fields.videoLink]) : "",
      videoDsps: fields.videoDsps ? getMultiSelectValue(page.properties[fields.videoDsps]) : [],
      releaseDate: getDateValue(page.properties[fields.releaseDate]),
      releaseTime: fields.releaseTime ? getRichTextValue(page.properties[fields.releaseTime]) : "",
      premiereDate: fields.premiereDate ? getDateValue(page.properties[fields.premiereDate]) : "",
      premiereTime: fields.premiereTime ? getRichTextValue(page.properties[fields.premiereTime]) : "",
      adultContent: fields.adultContent ? getMultiSelectValue(page.properties[fields.adultContent])[0] || "" : "",
      videoDescription: fields.videoDescription ? getRichTextValue(page.properties[fields.videoDescription]) : "",
      keywords: fields.keywords ? getRichTextValue(page.properties[fields.keywords]) : "",
      notes: getRichTextValue(page.properties[fields.notes])
    },
    existingAssets: {
      thumbnail: thumbnailFiles.length > 0
    },
    updatedAt: page.last_edited_time,
    createdAt: page.created_time
  };
}

function buildReleaseFormValuesFromPage(page, fields) {
  const kind = getSubmissionKind(page, fields);

  if (kind === "publishing") {
    return buildPublishingFormValuesFromPage(page, fields);
  }

  if (kind === "video") {
    return buildVideoFormValuesFromPage(page, fields);
  }

  const releaseTypeText = getReleaseTypeValue(page.properties[fields.releaseType]);
  const releaseType = /single/i.test(releaseTypeText) ? "single" : "album";
  const tracklistText = stripTracklistNumbering(getRichTextValue(page.properties[fields.tracklist]));
  const lyricsFiles = getFiles(page.properties[fields.lyrics]);
  const coverArtFiles = getFiles(page.properties[fields.coverArt]);
  const lyricsUrl = lyricsFiles.find((file) => file.type === "external")?.external?.url || "";
  const coverArtUrl = coverArtFiles.find((file) => file.type === "external")?.external?.url || "";

  return {
    pageId: page.id,
    kind: "release",
    releaseType,
    status: getSelectValue(page.properties[fields.status]) || "",
    formValues: {
      title: getRichTextValue(page.properties[fields.releaseTitle]),
      labelName: getRichTextValue(page.properties[fields.labelName]),
      mainArtists: getRichTextValue(page.properties[fields.mainArtists]),
      pLine: getRichTextValue(page.properties[fields.pLine]),
      featuredArtists: getRichTextValue(page.properties[fields.featuredArtists]),
      releaseVersion: getRichTextValue(page.properties[fields.releaseVersion]),
      tracklist: releaseType === "album" ? tracklistText : "",
      explicit: getSelectValue(page.properties[fields.explicit]) || "Non-Explicit",
      dealTags: getMultiSelectValue(page.properties[fields.dealTags]),
      distributor: getMultiSelectValue(page.properties[fields.distributor])[0] || "",
      mainGenre: getRichTextValue(page.properties[fields.mainGenre]),
      subGenre: getRichTextValue(page.properties[fields.subGenre]),
      secondaryGenre: getRichTextValue(page.properties[fields.secondaryGenre]),
      secondarySubGenre: getRichTextValue(page.properties[fields.secondarySubGenre]),
      releaseDate: getDateValue(page.properties[fields.releaseDate]),
      preorderDate: getDateValue(page.properties[fields.preorderDate]),
      recordingDate: getDateValue(page.properties[fields.recordingDate]),
      socialReleaseDate: getDateValue(page.properties[fields.socialReleaseDate]),
      audioFileLink: getUrlValue(page.properties[fields.audioFileLink]),
      lyricsUrl,
      coverArtUrl,
      dolbyAtmosLink: getUrlValue(page.properties[fields.dolbyAtmosLink]),
      appleMotionArtLink: getUrlValue(page.properties[fields.appleMotionArtLink]),
      waterfallRelease: releaseType === "single" ? getSelectValue(page.properties[fields.waterfallRelease]) || "" : "",
      waterfallTracklist: releaseType === "single" ? tracklistText : "",
      writersSplits: getRichTextValue(page.properties[fields.writersSplits]),
      publisherInformation: getRichTextValue(page.properties[fields.publisherInformation]),
      producerCredits: getRichTextValue(page.properties[fields.producerCredits]),
      notes: getRichTextValue(page.properties[fields.notes])
    },
    existingAssets: {
      lyrics: lyricsFiles.length > 0,
      coverArt: coverArtFiles.length > 0
    },
    updatedAt: page.last_edited_time,
    createdAt: page.created_time
  };
}

async function buildReleaseProperties({ notion, payload, files, session, existingPage = null }) {
  const releaseSchema = await getReleaseSchema();
  const fields = buildResolvedFieldMap(releaseSchema.properties);
  const tracklistValue =
    payload.releaseType === "album"
      ? splitTrackLines(payload.tracklist)
          .map((line, index) => `${index + 1}. ${line}`)
          .join("\n")
      : payload.waterfallRelease === "Yes"
        ? splitTrackLines(payload.waterfallTracklist)
            .map((line, index) => `${index + 1}. ${line}`)
            .join("\n")
        : "";

  const lyricsUpload = await uploadFileToNotion(notion, files.lyricsFile);
  const coverArtUpload = await uploadFileToNotion(notion, files.coverArtFile);
  const lyricsExternal = buildNotionFileValue(payload.lyricsUrl, "Lyrics URL");
  const coverArtExternal = buildNotionFileValue(payload.coverArtUrl, "Cover Art URL");
  const existingLyricsFiles = existingPage ? getFiles(existingPage.properties[fields.lyrics]) : [];
  const existingCoverArtFiles = existingPage ? getFiles(existingPage.properties[fields.coverArt]) : [];
  const hasNewLyrics = Boolean(lyricsUpload || lyricsExternal);
  const hasNewCoverArt = Boolean(coverArtUpload || coverArtExternal);
  const lyricsFiles = hasNewLyrics ? [lyricsExternal, lyricsUpload].filter(Boolean) : existingLyricsFiles;
  const coverArtFiles = hasNewCoverArt ? [coverArtExternal, coverArtUpload].filter(Boolean) : existingCoverArtFiles;

  const properties = {
    [fields.releaseTitle]: {
      title: toRichText(payload.title)
    },
    [fields.releaseType]: {
      rich_text: toRichText(payload.releaseType === "album" ? "Album / EP" : "Single")
    },
    [fields.labelName]: {
      rich_text: toRichText(payload.labelName)
    },
    [fields.submitterEmail]: {
      rich_text: toRichText(session.email || "")
    },
    [fields.mainArtists]: {
      rich_text: toRichText(payload.mainArtists)
    },
    [fields.pLine]: {
      rich_text: toRichText(payload.pLine)
    },
    [fields.featuredArtists]: {
      rich_text: toRichText(payload.featuredArtists)
    },
    [fields.releaseVersion]: {
      rich_text: toRichText(payload.releaseVersion)
    },
    [fields.productVersion]: buildNamedPropertyValue(releaseSchema.properties[fields.productVersion], "All DSPs (Main)"),
    [fields.tracklist]: {
      rich_text: toRichText(tracklistValue)
    },
    [fields.explicit]: {
      select: payload.explicit ? { name: payload.explicit } : null
    },
    [fields.dealTags]: {
      multi_select: payload.dealTags.map((name) => ({ name }))
    },
    [fields.distributor]: {
      multi_select: payload.distributor ? [{ name: payload.distributor }] : []
    },
    [fields.mainGenre]: {
      rich_text: toRichText(payload.mainGenre)
    },
    [fields.subGenre]: {
      rich_text: toRichText(payload.subGenre)
    },
    [fields.secondaryGenre]: {
      rich_text: toRichText(payload.secondaryGenre)
    },
    [fields.secondarySubGenre]: {
      rich_text: toRichText(payload.secondarySubGenre)
    },
    [fields.releaseDate]: {
      date: payload.releaseDate ? { start: payload.releaseDate } : null
    },
    [fields.preorderDate]: {
      date: payload.preorderDate ? { start: payload.preorderDate } : null
    },
    [fields.recordingDate]: {
      date: payload.recordingDate ? { start: payload.recordingDate } : null
    },
    [fields.socialReleaseDate]: {
      date: payload.socialReleaseDate ? { start: payload.socialReleaseDate } : null
    },
    [fields.audioFileLink]: {
      url: payload.audioFileLink || null
    },
    [fields.lyrics]: {
      files: lyricsFiles
    },
    [fields.coverArt]: {
      files: coverArtFiles
    },
    [fields.dolbyAtmosLink]: {
      url: payload.dolbyAtmosLink || null
    },
    [fields.appleMotionArtLink]: {
      url: payload.appleMotionArtLink || null
    },
    [fields.waterfallRelease]: {
      select: payload.releaseType === "single" && payload.waterfallRelease ? { name: payload.waterfallRelease } : null
    },
    [fields.writersSplits]: {
      rich_text: toRichText(payload.writersSplits)
    },
    [fields.publisherInformation]: {
      rich_text: toRichText(payload.publisherInformation)
    },
    [fields.producerCredits]: {
      rich_text: toRichText(payload.producerCredits)
    },
    [fields.notes]: {
      rich_text: toRichText(payload.notes)
    },
    [fields.coverArtComplete]: {
      checkbox: Boolean(coverArtFiles.length)
    },
    [fields.lyricsComplete]: {
      checkbox: Boolean(lyricsFiles.length)
    },
    [fields.dolbyAtmosComplete]: {
      checkbox: Boolean(payload.dolbyAtmosLink)
    },
    [fields.masterAudioComplete]: {
      checkbox: Boolean(payload.audioFileLink)
    },
  };

  // Only stamp workflow statuses on first submission; edits must not overwrite
  // the team's progress (In-Progress, Delivered, ...) in Notion. Status casing
  // matches the live Notion status options exactly.
  if (!existingPage) {
    properties[fields.nmdStatus] = {
      select: { name: "Queue" }
    };
    properties[fields.status] = {
      status: { name: "Not started" }
    };
  }

  if (fields.appleMotionArtComplete) {
    properties[fields.appleMotionArtComplete] = {
      checkbox: Boolean(payload.appleMotionArtLink)
    };
  }

  return { properties, fields };
}

function setIfResolved(properties, fieldName, value) {
  if (fieldName) {
    properties[fieldName] = value;
  }
}

async function buildPublishingProperties({ notion, payload, files, session, existingPage = null }) {
  const releaseSchema = await getReleaseSchema();
  const fields = buildResolvedFieldMap(releaseSchema.properties);

  const lyricsUpload = await uploadFileToNotion(notion, files.lyricsFile);
  const coverArtUpload = await uploadFileToNotion(notion, files.coverArtFile);
  const lyricsExternal = buildNotionFileValue(payload.lyricsUrl, "Lyrics URL");
  const coverArtExternal = buildNotionFileValue(payload.coverArtUrl, "Cover Art URL");
  const existingLyricsFiles = existingPage ? getFiles(existingPage.properties[fields.lyrics]) : [];
  const existingCoverArtFiles = existingPage ? getFiles(existingPage.properties[fields.coverArt]) : [];
  const lyricsFiles = lyricsUpload || lyricsExternal ? [lyricsExternal, lyricsUpload].filter(Boolean) : existingLyricsFiles;
  const coverArtFiles = coverArtUpload || coverArtExternal ? [coverArtExternal, coverArtUpload].filter(Boolean) : existingCoverArtFiles;

  const properties = {
    [fields.releaseTitle]: {
      title: toRichText(payload.title)
    },
    [fields.submitterEmail]: {
      rich_text: toRichText(session.email || "")
    },
    [fields.releaseVersion]: {
      rich_text: toRichText(payload.releaseVersion)
    },
    [fields.mainArtists]: {
      rich_text: toRichText(payload.mainArtists)
    },
    [fields.featuredArtists]: {
      rich_text: toRichText(payload.featuredArtists)
    },
    [fields.labelName]: {
      rich_text: toRichText(payload.labelInfo)
    },
    [fields.releaseDate]: {
      date: payload.releaseDate ? { start: payload.releaseDate } : null
    },
    [fields.audioFileLink]: {
      url: payload.audioFileLink || null
    },
    [fields.lyrics]: {
      files: lyricsFiles
    },
    [fields.coverArt]: {
      files: coverArtFiles
    },
    [fields.notes]: {
      rich_text: toRichText(payload.notes)
    },
    [fields.coverArtComplete]: {
      checkbox: Boolean(coverArtFiles.length)
    },
    [fields.lyricsComplete]: {
      checkbox: Boolean(lyricsFiles.length)
    },
    [fields.masterAudioComplete]: {
      checkbox: Boolean(payload.audioFileLink)
    }
  };

  setIfResolved(properties, fields.publishingTag, { select: { name: "Publishing" } });
  setIfResolved(properties, fields.altsStems, {
    multi_select: (payload.altsStems || []).map((name) => ({ name }))
  });
  setIfResolved(properties, fields.creationDate, {
    date: payload.creationDate ? { start: payload.creationDate } : null
  });
  setIfResolved(properties, fields.ahWritersSplits, { rich_text: toRichText(payload.ahWritersSplits) });
  setIfResolved(properties, fields.tpWritersSplits, { rich_text: toRichText(payload.tpWritersSplits) });
  setIfResolved(properties, fields.ahWritersPubInfo, { rich_text: toRichText(payload.ahWritersPubInfo) });
  setIfResolved(properties, fields.tpWritersPubInfo, { rich_text: toRichText(payload.tpWritersPubInfo) });
  setIfResolved(properties, fields.dealType, {
    multi_select: (payload.dealType || []).map((name) => ({ name }))
  });
  setIfResolved(properties, fields.isrc, { rich_text: toRichText(payload.isrc) });
  setIfResolved(properties, fields.containsSample, {
    select: payload.containsSample ? { name: payload.containsSample } : null
  });
  setIfResolved(properties, fields.sampleTitleWriters, { rich_text: toRichText(payload.sampleTitleWriters) });

  if (!existingPage) {
    properties[fields.status] = {
      status: { name: "External" }
    };
  }

  return { properties, fields };
}

async function buildVideoProperties({ notion, payload, files, session, existingPage = null }) {
  const releaseSchema = await getReleaseSchema();
  const fields = buildResolvedFieldMap(releaseSchema.properties);

  const thumbnailUpload = await uploadFileToNotion(notion, files.thumbnailFile);
  const existingThumbnailFiles =
    existingPage && fields.thumbnail ? getFiles(existingPage.properties[fields.thumbnail]) : [];
  const thumbnailFiles = thumbnailUpload ? [thumbnailUpload] : existingThumbnailFiles;

  const properties = {
    [fields.releaseTitle]: {
      title: toRichText(payload.title)
    },
    [fields.submitterEmail]: {
      rich_text: toRichText(session.email || "")
    },
    [fields.mainArtists]: {
      rich_text: toRichText(payload.mainArtists)
    },
    [fields.featuredArtists]: {
      rich_text: toRichText(payload.featuredArtists)
    },
    [fields.productVersion]: {
      multi_select: (payload.productVersions || []).map((name) => ({ name }))
    },
    [fields.releaseDate]: {
      date: payload.releaseDate ? { start: payload.releaseDate } : null
    },
    [fields.notes]: {
      rich_text: toRichText(payload.notes)
    }
  };

  setIfResolved(properties, fields.videoDistributor, { rich_text: toRichText(payload.distributor) });
  setIfResolved(properties, fields.videoLink, { url: payload.videoLink || null });
  setIfResolved(properties, fields.videoDsps, {
    multi_select: (payload.videoDsps || []).map((name) => ({ name }))
  });
  setIfResolved(properties, fields.releaseTime, { rich_text: toRichText(payload.releaseTime) });
  setIfResolved(properties, fields.premiereDate, {
    date: payload.premiereDate ? { start: payload.premiereDate } : null
  });
  setIfResolved(properties, fields.premiereTime, { rich_text: toRichText(payload.premiereTime) });
  setIfResolved(properties, fields.adultContent, {
    multi_select: payload.adultContent ? [{ name: payload.adultContent }] : []
  });
  setIfResolved(properties, fields.thumbnail, { files: thumbnailFiles });
  setIfResolved(properties, fields.videoDescription, { rich_text: toRichText(payload.videoDescription) });
  setIfResolved(properties, fields.keywords, { rich_text: toRichText(payload.keywords) });
  setIfResolved(properties, fields.thumbnailComplete, { checkbox: Boolean(thumbnailFiles.length) });
  setIfResolved(properties, fields.videoDescriptionComplete, { checkbox: Boolean(payload.videoDescription) });
  setIfResolved(properties, fields.keywordsComplete, { checkbox: Boolean(payload.keywords) });
  setIfResolved(properties, fields.musicVideoFileComplete, { checkbox: Boolean(payload.videoLink) });

  if (!existingPage) {
    properties[fields.status] = {
      status: { name: "Not started" }
    };
  }

  return { properties, fields };
}

async function assertSubmissionOwnership(page, fields, session) {
  const existingEmail = getRichTextValue(page.properties[fields.submitterEmail]).trim().toLowerCase();

  if (!session?.email || existingEmail !== session.email.trim().toLowerCase()) {
    throw new Error("Unauthorized to edit this submission.");
  }
}

export async function createPublishingSubmission(payload, files, session) {
  const notion = createNotionClient();
  const env = getEnv();
  const { properties } = await buildPublishingProperties({ notion, payload, files, session });

  return notion.pages.create({
    parent: {
      data_source_id: env.notionReleaseScheduleDb
    },
    properties
  });
}

export async function updatePublishingSubmission(pageId, payload, files, session) {
  const notion = createNotionClient();
  const { page, fields } = await getReleaseSubmissionById(pageId);

  await assertSubmissionOwnership(page, fields, session);

  const { properties } = await buildPublishingProperties({ notion, payload, files, session, existingPage: page });

  return notion.pages.update({
    page_id: pageId,
    properties
  });
}

export async function createVideoSubmission(payload, files, session) {
  const notion = createNotionClient();
  const env = getEnv();
  const { properties } = await buildVideoProperties({ notion, payload, files, session });

  return notion.pages.create({
    parent: {
      data_source_id: env.notionReleaseScheduleDb
    },
    properties
  });
}

export async function updateVideoSubmission(pageId, payload, files, session) {
  const notion = createNotionClient();
  const { page, fields } = await getReleaseSubmissionById(pageId);

  await assertSubmissionOwnership(page, fields, session);

  const { properties } = await buildVideoProperties({ notion, payload, files, session, existingPage: page });

  return notion.pages.update({
    page_id: pageId,
    properties
  });
}

export async function isEmailAllowed(email) {
  const notion = createNotionClient();
  const { notionUsersDb } = getEnv();
  const schema = await getUsersSchema();
  const [propertyName, property] = findAllowlistProperty(schema.properties);

  const response = await notion.dataSources.query({
    data_source_id: notionUsersDb,
    page_size: 1,
    result_type: "page",
    filter: buildAllowlistFilter(propertyName, property.type, email.trim().toLowerCase())
  });

  return response.results.some((result) => {
    if (result.object !== "page") {
      return false;
    }

    const propertyValue = result.properties[propertyName];

    if (!propertyValue) {
      return false;
    }

    if (property.type === "email") {
      return propertyValue.email?.trim().toLowerCase() === email.trim().toLowerCase();
    }

    if (property.type === "rich_text") {
      return getPlainTitle(propertyValue.rich_text).trim().toLowerCase() === email.trim().toLowerCase();
    }

    return getPlainTitle(propertyValue.title).trim().toLowerCase() === email.trim().toLowerCase();
  });
}

// --- Single-property writes (Beacon Admin inline edits) ----------------------
// Writes exactly one property on a release page — used for checkbox toggles
// and values of portal-added custom fields. Never touches other properties.

export function buildSinglePropertyValue(propertyType, value) {
  switch (propertyType) {
    case "checkbox":
      return { checkbox: Boolean(value) };
    case "rich_text":
      return { rich_text: toRichText(String(value ?? "")) };
    case "title":
      return { title: toRichText(String(value ?? "")) };
    case "date":
      return { date: value ? { start: String(value) } : null };
    case "select":
      return { select: value ? { name: String(value) } : null };
    case "status":
      return { status: value ? { name: String(value) } : null };
    case "multi_select":
      return {
        multi_select: (Array.isArray(value) ? value : String(value || "").split(","))
          .map((name) => String(name).trim())
          .filter(Boolean)
          .map((name) => ({ name }))
      };
    case "url":
      return { url: value ? String(value) : null };
    case "email":
      return { email: value ? String(value) : null };
    case "phone_number":
      return { phone_number: value ? String(value) : null };
    case "number": {
      const number = Number(value);

      return { number: value === "" || value === null || Number.isNaN(number) ? null : number };
    }
    default:
      throw new Error(`Property type ${propertyType} cannot be edited here.`);
  }
}

export async function setNotionProperty(pageId, propertyName, propertyType, value) {
  const notion = createNotionClient();

  return notion.pages.update({
    page_id: pageId,
    properties: {
      [propertyName]: buildSinglePropertyValue(propertyType, value)
    }
  });
}

// Adds a new property to the Notion release schedule DB (portal-driven schema
// evolution). Returns the created property's schema from the updated data
// source. Note: Notion's API cannot create `status` properties.
export async function addReleaseScheduleProperty(name, propertySchema) {
  const notion = createNotionClient();
  const env = getEnv();

  const response = await notion.dataSources.update({
    data_source_id: env.notionReleaseScheduleDb,
    properties: {
      [name]: propertySchema
    }
  });

  // Bust the memoized schema so field resolution sees the new property.
  releaseSchemaPromise = undefined;

  return response.properties?.[name] || null;
}

// --- Allowlist management (Beacon Admin "Allowed Users") ---------------------
// The users DB is the portal's access allowlist: one page per allowed email,
// stored in the title-ish property that findAllowlistProperty resolves.

function buildAllowlistPropertyValue(propertyName, property, email) {
  if (property.type === "email") {
    return { [propertyName]: { email } };
  }

  if (property.type === "rich_text") {
    return { [propertyName]: { rich_text: toRichText(email) } };
  }

  return { [propertyName]: { title: toRichText(email) } };
}

function readAllowlistEmail(page, propertyName, property) {
  const value = page.properties?.[propertyName];

  if (!value) {
    return "";
  }

  if (property.type === "email") {
    return value.email || "";
  }

  if (property.type === "rich_text") {
    return getPlainTitle(value.rich_text || []);
  }

  return getPlainTitle(value.title || []);
}

export async function listAllowlistUsers() {
  const notion = createNotionClient();
  const { notionUsersDb } = getEnv();
  const schema = await getUsersSchema();
  const [propertyName, property] = findAllowlistProperty(schema.properties);

  const users = [];
  let cursor = undefined;

  do {
    const response = await notion.dataSources.query({
      data_source_id: notionUsersDb,
      result_type: "page",
      page_size: 100,
      start_cursor: cursor
    });

    for (const result of response.results) {
      if (result.object !== "page") {
        continue;
      }

      users.push({
        pageId: result.id,
        email: readAllowlistEmail(result, propertyName, property),
        createdAt: result.created_time,
        updatedAt: result.last_edited_time,
        page: result
      });
    }

    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  users.sort((a, b) => a.email.localeCompare(b.email));

  return users;
}

export async function createAllowlistUser(email) {
  const notion = createNotionClient();
  const { notionUsersDb } = getEnv();
  const schema = await getUsersSchema();
  const [propertyName, property] = findAllowlistProperty(schema.properties);

  return notion.pages.create({
    parent: { data_source_id: notionUsersDb },
    properties: buildAllowlistPropertyValue(propertyName, property, email)
  });
}

export async function updateAllowlistUser(pageId, email) {
  const notion = createNotionClient();
  const schema = await getUsersSchema();
  const [propertyName, property] = findAllowlistProperty(schema.properties);

  return notion.pages.update({
    page_id: pageId,
    properties: buildAllowlistPropertyValue(propertyName, property, email)
  });
}

export async function archiveAllowlistUser(pageId) {
  const notion = createNotionClient();

  return notion.pages.update({
    page_id: pageId,
    archived: true
  });
}

export async function createReleaseSubmission(payload, files, session) {
  const notion = createNotionClient();
  const env = getEnv();
  const { properties } = await buildReleaseProperties({ notion, payload, files, session });

  const response = await notion.pages.create({
    parent: {
      data_source_id: env.notionReleaseScheduleDb
    },
    properties
  });

  return response;
}

export async function findReleaseSubmissionsByTitleAndEmail(title, email) {
  const notion = createNotionClient();
  const env = getEnv();
  const releaseSchema = await getReleaseSchema();
  const fields = buildResolvedFieldMap(releaseSchema.properties);

  const response = await notion.dataSources.query({
    data_source_id: env.notionReleaseScheduleDb,
    result_type: "page",
    page_size: 10,
    filter: buildReleaseQueryFilter(fields, releaseSchema, title.trim(), email.trim())
  });

  return response.results
    .filter((result) => result.object === "page")
    .map((page) => buildReleaseFormValuesFromPage(page, fields));
}

export async function findReleaseSubmissionsByEmail(email) {
  const notion = createNotionClient();
  const env = getEnv();
  const releaseSchema = await getReleaseSchema();
  const fields = buildResolvedFieldMap(releaseSchema.properties);
  const emailField = releaseSchema.properties[fields.submitterEmail];

  const emailFilter =
    emailField?.type === "email"
      ? { property: fields.submitterEmail, email: { equals: email.trim() } }
      : { property: fields.submitterEmail, rich_text: { equals: email.trim() } };

  const response = await notion.dataSources.query({
    data_source_id: env.notionReleaseScheduleDb,
    result_type: "page",
    page_size: 100,
    filter: emailFilter,
    sorts: [
      {
        timestamp: "last_edited_time",
        direction: "descending"
      }
    ]
  });

  return response.results
    .filter((result) => result.object === "page")
    .map((page) => buildReleaseFormValuesFromPage(page, fields));
}

export async function fetchAllReleaseSchedulePages(onProgress) {
  const notion = createNotionClient();
  const env = getEnv();
  const pages = [];
  let cursor;

  do {
    const response = await notion.dataSources.query({
      data_source_id: env.notionReleaseScheduleDb,
      result_type: "page",
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {})
    });

    pages.push(...response.results.filter((result) => result.object === "page"));
    cursor = response.has_more ? response.next_cursor : undefined;
    onProgress?.(pages.length);
  } while (cursor);

  return pages;
}

export async function getReleaseSubmissionById(pageId) {
  const notion = createNotionClient();
  const releaseSchema = await getReleaseSchema();
  const fields = buildResolvedFieldMap(releaseSchema.properties);
  const page = await notion.pages.retrieve({ page_id: pageId });

  if (page.object !== "page") {
    throw new Error("Submission not found.");
  }

  return {
    page,
    fields,
    mapped: buildReleaseFormValuesFromPage(page, fields)
  };
}

export async function updateReleaseSubmission(pageId, payload, files, session) {
  const notion = createNotionClient();
  const { page } = await getReleaseSubmissionById(pageId);
  const releaseSchema = await getReleaseSchema();
  const fields = buildResolvedFieldMap(releaseSchema.properties);
  const existingEmail = getRichTextValue(page.properties[fields.submitterEmail]).trim().toLowerCase();

  if (!session?.email || existingEmail !== session.email.trim().toLowerCase()) {
    throw new Error("Unauthorized to edit this submission.");
  }

  const { properties } = await buildReleaseProperties({
    notion,
    payload,
    files,
    session,
    existingPage: page
  });

  return notion.pages.update({
    page_id: pageId,
    properties
  });
}

// --- Admin (internal portal) updates -----------------------------------------
// Same builders as the public flows, but: no submitter-ownership check, the
// original submitter's email is preserved, and workflow fields (Status,
// NMD Status, Product Version) may be set explicitly by the admin.

const EMPTY_FILES = { lyricsFile: null, coverArtFile: null, thumbnailFile: null };

function applyAdminWorkflow(properties, fields, releaseSchema, workflow) {
  if (!workflow) {
    return;
  }

  if (workflow.status && fields.status) {
    properties[fields.status] = { status: { name: workflow.status } };
  }

  if (workflow.nmdStatus && fields.nmdStatus) {
    properties[fields.nmdStatus] = { select: { name: workflow.nmdStatus } };
  }

  if (workflow.productVersion && fields.productVersion) {
    properties[fields.productVersion] = buildNamedPropertyValue(
      releaseSchema.properties[fields.productVersion],
      workflow.productVersion
    );
  }
}

const ADMIN_BUILDERS = {
  audio: buildReleaseProperties,
  video: buildVideoProperties,
  publishing: buildPublishingProperties
};

export async function adminUpdateSubmission(kind, pageId, payload, session, workflow = null) {
  const builder = ADMIN_BUILDERS[kind];

  if (!builder) {
    throw new Error(`Unknown submission kind: ${kind}`);
  }

  const notion = createNotionClient();
  const releaseSchema = await getReleaseSchema();
  const { page, fields } = await getReleaseSubmissionById(pageId);

  const { properties } = await builder({
    notion,
    payload,
    files: EMPTY_FILES,
    session,
    existingPage: page
  });

  // Keep the original submitter on record — admin edits are not resubmissions.
  properties[fields.submitterEmail] = {
    rich_text: toRichText(getRichTextValue(page.properties[fields.submitterEmail]) || "")
  };

  applyAdminWorkflow(properties, fields, releaseSchema, workflow);

  return notion.pages.update({
    page_id: pageId,
    properties
  });
}

export async function adminCreateSubmission(kind, payload, session, workflow = null) {
  const builder = ADMIN_BUILDERS[kind];

  if (!builder) {
    throw new Error(`Unknown submission kind: ${kind}`);
  }

  const notion = createNotionClient();
  const env = getEnv();
  const releaseSchema = await getReleaseSchema();
  const { properties, fields } = await builder({
    notion,
    payload,
    files: EMPTY_FILES,
    session
  });

  applyAdminWorkflow(properties, fields, releaseSchema, workflow);

  return notion.pages.create({
    parent: {
      data_source_id: env.notionReleaseScheduleDb
    },
    properties
  });
}
