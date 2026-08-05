import "server-only";

import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

// File storage for release assets. Files go straight from the browser to
// Supabase Storage using short-lived signed upload URLs, because Vercel caps
// serverless request bodies at 4.5 MB and masters/videos are far larger.
//
// The bucket is private: every read is served through a portal permalink that
// mints a fresh signed URL on demand, so links handed to Notion never rot the
// way Notion's own 1-hour S3 URLs do.

export const ASSET_BUCKET = "release-assets";

// Kinds the portal understands. `notionAttach` marks the small assets that are
// also mirrored into Notion as real attachments; large media is linked instead.
export const ASSET_KINDS = {
  audio: { label: "Audio File(s)", notionAttach: false, notionUrlField: "audioFileLink" },
  video: { label: "Video File", notionAttach: false, notionUrlField: "videoLink" },
  dolby_atmos: { label: "Dolby Atmos Mix", notionAttach: false, notionUrlField: "dolbyAtmosLink" },
  motion_art: { label: "Apple Motion Art", notionAttach: false, notionUrlField: "appleMotionArtLink" },
  lyrics: { label: "Lyrics", notionAttach: true, notionUrlField: null },
  cover_art: { label: "Cover Art", notionAttach: true, notionUrlField: null },
  thumbnail: { label: "Thumbnail", notionAttach: true, notionUrlField: null }
};

// Above this, a file is never pushed through Notion's upload API even if its
// kind is normally attached; Notion gets a permalink instead.
export const NOTION_ATTACH_MAX_BYTES = 18 * 1024 * 1024;

function getConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";

  return { url: url.replace(/\/$/, ""), key };
}

export function isStorageConfigured() {
  const { url, key } = getConfig();
  return Boolean(url && key);
}

function getClient() {
  const { url, key } = getConfig();

  if (!url || !key) {
    throw new Error("Supabase Storage is not configured.");
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

function getConnectionString() {
  return (process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || "").replace(
    /[?&]sslmode=[^&]*/g,
    ""
  );
}

async function withDb(run) {
  const connectionString = getConnectionString();

  if (!connectionString) {
    throw new Error("Supabase Postgres connection is not configured.");
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    return await run(client);
  } finally {
    await client.end().catch(() => {});
  }
}

export async function ensureStorageSchema() {
  const supabase = getClient();
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = (buckets || []).some((bucket) => bucket.name === ASSET_BUCKET);

  if (!exists) {
    // No explicit fileSizeLimit: the bucket inherits the project's global cap,
    // which is the real ceiling anyway and varies by plan.
    const { error } = await supabase.storage.createBucket(ASSET_BUCKET, { public: false });

    if (error && !/already exists/i.test(error.message)) {
      throw new Error(`Could not create bucket: ${error.message}`);
    }
  }

  await withDb(async (client) => {
    await client.query(`
      create table if not exists public.release_assets (
        asset_id uuid primary key default gen_random_uuid(),
        submission_id uuid not null,
        notion_page_id uuid references public.release_schedule(notion_page_id) on delete set null,
        kind text not null,
        bucket_id text not null default '${ASSET_BUCKET}',
        storage_path text not null unique,
        file_name text not null,
        mime_type text,
        size_bytes bigint,
        uploaded_by text,
        source text not null default 'portal',
        notion_file_synced boolean not null default false,
        created_at timestamptz not null default now()
      )
    `);

    await client.query(
      "create index if not exists release_assets_page_idx on public.release_assets (notion_page_id)"
    );
    await client.query(
      "create index if not exists release_assets_submission_idx on public.release_assets (submission_id)"
    );
    await client.query(
      "create index if not exists release_assets_kind_idx on public.release_assets (kind)"
    );
  });

  const limits = await withDb(async (client) => {
    const { rows } = await client.query(
      "select name, public, file_size_limit from storage.buckets where name = $1",
      [ASSET_BUCKET]
    );

    return rows[0] || null;
  });

  return { bucket: ASSET_BUCKET, created: !exists, bucketConfig: limits };
}

function sanitizeFileName(name) {
  return String(name || "file")
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(-120);
}

export function buildStoragePath(submissionId, kind, fileName) {
  return `${submissionId}/${kind}/${Date.now()}-${sanitizeFileName(fileName)}`;
}

export async function createSignedUpload(submissionId, kind, fileName) {
  const supabase = getClient();
  const path = buildStoragePath(submissionId, kind, fileName);
  const { data, error } = await supabase.storage.from(ASSET_BUCKET).createSignedUploadUrl(path);

  if (error) {
    throw new Error(`Could not create upload URL: ${error.message}`);
  }

  return { path, signedUrl: data.signedUrl, token: data.token };
}

export async function createSignedDownloadUrl(path, expiresIn = 3600) {
  const supabase = getClient();
  const { data, error } = await supabase.storage.from(ASSET_BUCKET).createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(`Could not sign download URL: ${error.message}`);
  }

  return data.signedUrl;
}

export async function downloadAsset(path) {
  const supabase = getClient();
  const { data, error } = await supabase.storage.from(ASSET_BUCKET).download(path);

  if (error) {
    throw new Error(`Could not download asset: ${error.message}`);
  }

  return data;
}

export async function uploadBufferToStorage(path, body, contentType) {
  const supabase = getClient();
  const { error } = await supabase.storage.from(ASSET_BUCKET).upload(path, body, {
    contentType: contentType || "application/octet-stream",
    upsert: true
  });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  return path;
}

export async function recordAsset(asset) {
  return withDb(async (client) => {
    const { rows } = await client.query(
      `
      insert into public.release_assets
        (submission_id, notion_page_id, kind, storage_path, file_name, mime_type, size_bytes, uploaded_by, source, notion_file_synced)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      on conflict (storage_path) do update set
        notion_page_id = excluded.notion_page_id,
        notion_file_synced = excluded.notion_file_synced
      returning asset_id, storage_path, kind, file_name, size_bytes
      `,
      [
        asset.submissionId,
        asset.notionPageId || null,
        asset.kind,
        asset.storagePath,
        asset.fileName,
        asset.mimeType || null,
        asset.sizeBytes || null,
        asset.uploadedBy || null,
        asset.source || "portal",
        Boolean(asset.notionFileSynced)
      ]
    );

    return rows[0];
  });
}

export async function attachAssetsToPage(submissionId, notionPageId) {
  return withDb(async (client) => {
    const { rowCount } = await client.query(
      "update public.release_assets set notion_page_id = $2 where submission_id = $1 and notion_page_id is distinct from $2",
      [submissionId, notionPageId]
    );

    return rowCount;
  });
}

// Storage paths carry a timestamp, so re-running the backfill would otherwise
// copy the same Notion file again under a new name.
export async function isAlreadyBackfilled(notionPageId, kind, fileName) {
  return withDb(async (client) => {
    const { rows } = await client.query(
      `select 1 from public.release_assets
       where notion_page_id = $1 and kind = $2 and file_name = $3 and source = 'notion_backfill'
       limit 1`,
      [notionPageId, kind, fileName]
    );

    return rows.length > 0;
  });
}

export async function getAssetById(assetId) {
  return withDb(async (client) => {
    const { rows } = await client.query(
      "select * from public.release_assets where asset_id = $1",
      [assetId]
    );

    return rows[0] || null;
  });
}

export async function listAssetsForPage(notionPageId) {
  return withDb(async (client) => {
    const { rows } = await client.query(
      "select asset_id, kind, file_name, mime_type, size_bytes, created_at, storage_path from public.release_assets where notion_page_id = $1 order by created_at desc",
      [notionPageId]
    );

    return rows;
  });
}

// The real upload ceiling is the project's global Storage limit, which is not
// exposed by any read API. Probe it by asking for progressively larger bucket
// limits and seeing where the API refuses, then restore the inherited setting.
export async function detectMaxUploadBytes() {
  const supabase = getClient();
  const candidates = [
    ["50 MB", 52428800],
    ["200 MB", 209715200],
    ["500 MB", 524288000],
    ["1 GB", 1073741824],
    ["5 GB", 5368709120],
    ["50 GB", 53687091200]
  ];

  let highestAccepted = null;

  for (const [label, bytes] of candidates) {
    const { error } = await supabase.storage.updateBucket(ASSET_BUCKET, { fileSizeLimit: bytes });

    if (error) {
      break;
    }

    highestAccepted = { label, bytes };
  }

  await supabase.storage.updateBucket(ASSET_BUCKET, { fileSizeLimit: null });

  return highestAccepted;
}

export async function getAssetStats() {
  return withDb(async (client) => {
    const { rows } = await client.query(`
      select kind, source, count(*) as files, pg_size_pretty(sum(size_bytes)) as total_size
      from public.release_assets group by 1, 2 order by 1, 2
    `);

    return rows;
  });
}
