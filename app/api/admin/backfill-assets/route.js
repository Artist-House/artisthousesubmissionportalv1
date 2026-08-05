import { NextResponse } from "next/server";
import { fetchAllReleaseSchedulePages } from "@/lib/notion";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import {
  buildStoragePath,
  isAlreadyBackfilled,
  isStorageConfigured,
  recordAsset,
  uploadBufferToStorage
} from "@/lib/storage";
import { INTERNAL_EMAIL_DOMAIN } from "@/lib/release-config";

export const runtime = "nodejs";
export const maxDuration = 300;

// Notion property name -> asset kind for the files we mirror into storage.
const FILE_PROPERTIES = {
  Lyrics: "lyrics",
  "Cover Art": "cover_art",
  Thumbnail: "thumbnail"
};

async function isAllowed(request) {
  const secret = process.env.SYNC_SECRET;
  const provided = request.headers.get("x-sync-secret");

  if (secret && provided && provided === secret) {
    return true;
  }

  const session = await readSessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  return Boolean(
    session?.authorized && session.email?.trim().toLowerCase().endsWith(INTERNAL_EMAIL_DOMAIN)
  );
}

function getFileEntries(page) {
  const entries = [];

  for (const [propertyName, kind] of Object.entries(FILE_PROPERTIES)) {
    const property = page.properties?.[propertyName];

    if (property?.type !== "files") {
      continue;
    }

    for (const file of property.files || []) {
      // Notion's own S3 links expire, so they are only usable right now, during
      // this run -- which is exactly why the bytes are being copied out.
      const url = file.type === "file" ? file.file?.url : file.external?.url;

      if (url) {
        entries.push({ kind, url, fileName: file.name || `${kind}-file` });
      }
    }
  }

  return entries;
}

export async function POST(request) {
  if (!(await isAllowed(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Supabase Storage is not configured." }, { status: 400 });
  }

  const limit = Number(request.nextUrl.searchParams.get("limit") || 0);
  const startedAt = Date.now();
  const summary = { pagesScanned: 0, filesFound: 0, copied: 0, alreadyPresent: 0, skipped: 0, failures: [] };

  try {
    const pages = await fetchAllReleaseSchedulePages();

    for (const page of pages) {
      summary.pagesScanned += 1;
      const entries = getFileEntries(page);
      summary.filesFound += entries.length;

      for (const entry of entries) {
        if (limit && summary.copied >= limit) {
          summary.skipped += 1;
          continue;
        }

        try {
          if (await isAlreadyBackfilled(page.id, entry.kind, entry.fileName)) {
            summary.alreadyPresent += 1;
            continue;
          }

          const response = await fetch(entry.url);

          if (!response.ok) {
            throw new Error(`Fetch failed (${response.status})`);
          }

          const buffer = Buffer.from(await response.arrayBuffer());
          const path = buildStoragePath(page.id, entry.kind, entry.fileName);

          await uploadBufferToStorage(path, buffer, response.headers.get("content-type"));
          await recordAsset({
            submissionId: page.id,
            notionPageId: page.id,
            kind: entry.kind,
            storagePath: path,
            fileName: entry.fileName,
            mimeType: response.headers.get("content-type"),
            sizeBytes: buffer.length,
            uploadedBy: "notion-backfill",
            source: "notion_backfill",
            notionFileSynced: true
          });

          summary.copied += 1;
        } catch (error) {
          summary.failures.push({
            pageId: page.id,
            file: entry.fileName,
            message: error?.message || String(error)
          });
        }
      }
    }

    return NextResponse.json({
      ok: summary.failures.length === 0,
      ...summary,
      failures: summary.failures.slice(0, 10),
      failureCount: summary.failures.length,
      durationMs: Date.now() - startedAt
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Backfill failed.", ...summary, durationMs: Date.now() - startedAt },
      { status: 500 }
    );
  }
}
