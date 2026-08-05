import { NextResponse } from "next/server";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import {
  detectMaxUploadBytes,
  ensureStorageSchema,
  getAssetStats,
  isStorageConfigured
} from "@/lib/storage";
import { INTERNAL_EMAIL_DOMAIN } from "@/lib/release-config";

export const runtime = "nodejs";
export const maxDuration = 120;

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

export async function POST(request) {
  if (!(await isAllowed(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Supabase Storage is not configured." }, { status: 400 });
  }

  try {
    const result = await ensureStorageSchema();

    const maxUpload = request.nextUrl.searchParams.get("probe") === "1" ? await detectMaxUploadBytes() : null;

    return NextResponse.json({ ok: true, ...result, maxUpload, stats: await getAssetStats() });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Setup failed." }, { status: 500 });
  }
}

export async function GET(request) {
  if (!(await isAllowed(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    return NextResponse.json({ ok: true, stats: await getAssetStats() });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Stats failed." }, { status: 500 });
  }
}
