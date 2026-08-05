import { NextResponse } from "next/server";
import { fetchAllReleaseSchedulePages } from "@/lib/notion";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import {
  getMirrorCounts,
  getRecentMirroredRows,
  isSupabaseConfigured,
  syncNotionPagesToSupabase
} from "@/lib/supabase";
import { INTERNAL_EMAIL_DOMAIN } from "@/lib/release-config";

export const runtime = "nodejs";
export const maxDuration = 300;

async function isAllowed(request) {
  const secret = process.env.SYNC_SECRET;
  const provided = request.headers.get("x-sync-secret");

  if (secret && provided && provided === secret) {
    return true;
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await readSessionToken(token);

  return Boolean(
    session?.authorized && session.email?.trim().toLowerCase().endsWith(INTERNAL_EMAIL_DOMAIN)
  );
}

export async function GET(request) {
  if (!(await isAllowed(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 400 });
  }

  try {
    return NextResponse.json({
      ok: true,
      tableCounts: await getMirrorCounts(),
      recent: await getRecentMirroredRows()
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Count failed." }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await isAllowed(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 400 });
  }

  const startedAt = Date.now();

  try {
    const pages = await fetchAllReleaseSchedulePages();
    const { synced, unifiedSynced, failed } = await syncNotionPagesToSupabase(pages);

    return NextResponse.json({
      ok: failed.length === 0,
      pagesFetched: pages.length,
      releaseScheduleRowsSynced: synced,
      unifiedRowsSynced: unifiedSynced,
      failedCount: failed.length,
      failures: failed.slice(0, 5),
      tableCounts: await getMirrorCounts(),
      durationMs: Date.now() - startedAt
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error?.message || "Sync failed.",
        durationMs: Date.now() - startedAt
      },
      { status: 500 }
    );
  }
}
