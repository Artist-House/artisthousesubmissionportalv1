import { NextResponse } from "next/server";
import { fetchAllReleaseSchedulePages } from "@/lib/notion";
import {
  getMirrorCounts,
  isSupabaseConfigured,
  syncNotionPagesToSupabase
} from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 300;

// Invoked by Vercel Cron (see vercel.json). Vercel sends
// `Authorization: Bearer ${CRON_SECRET}` when the CRON_SECRET env var is set;
// the SYNC_SECRET header is accepted too so the job can be triggered manually.
function isAllowed(request) {
  const cronSecret = process.env.CRON_SECRET;
  const syncSecret = process.env.SYNC_SECRET;
  const authorization = request.headers.get("authorization");
  const provided = request.headers.get("x-sync-secret");

  if (cronSecret && authorization === `Bearer ${cronSecret}`) {
    return true;
  }

  return Boolean(syncSecret && provided && provided === syncSecret);
}

export async function GET(request) {
  if (!isAllowed(request)) {
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
