import { NextResponse } from "next/server";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { ASSET_KINDS, createSignedUpload, isStorageConfigured } from "@/lib/storage";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request) {
  const session = await readSessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (!session?.authorized) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "File storage is not configured." }, { status: 400 });
  }

  try {
    const { submissionId, kind, fileName } = await request.json();

    if (!UUID_PATTERN.test(String(submissionId || ""))) {
      return NextResponse.json({ error: "A valid submission id is required." }, { status: 400 });
    }

    if (!ASSET_KINDS[kind]) {
      return NextResponse.json({ error: `Unknown asset kind: ${kind}` }, { status: 400 });
    }

    if (!fileName) {
      return NextResponse.json({ error: "A file name is required." }, { status: 400 });
    }

    const upload = await createSignedUpload(submissionId, kind, fileName);

    return NextResponse.json({ ok: true, ...upload });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Could not start upload." }, { status: 500 });
  }
}
