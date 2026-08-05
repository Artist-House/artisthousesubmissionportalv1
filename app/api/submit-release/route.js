import { NextResponse } from "next/server";
import { normalizeDistributor } from "@/lib/release-config";
import { saveRelease } from "@/lib/releases";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { releasePayloadSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await readSessionToken(token);

  if (!session?.authorized) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const payloadText = formData.get("payload");

    if (typeof payloadText !== "string") {
      return NextResponse.json({ error: "Missing payload." }, { status: 400 });
    }

    const parsedPayload = releasePayloadSchema.parse(JSON.parse(payloadText));
    const normalizedPayload = {
      ...parsedPayload,
      dealTags: ["Distribution Only"],
      distributor: normalizeDistributor("Fuga")
    };

    const lyricsFile = formData.get("lyricsFile");
    const coverArtFile = formData.get("coverArtFile");

    const filePayload = {
      lyricsFile: lyricsFile instanceof File ? lyricsFile : null,
      coverArtFile: coverArtFile instanceof File ? coverArtFile : null
    };

    const result = await saveRelease({
      kind: "audio",
      payload: normalizedPayload,
      files: filePayload,
      session,
      notionPageId: normalizedPayload.pageId || null
    });

    return NextResponse.json({
      ok: true,
      pageId: result.pageId,
      syncWarning: result.syncWarning || undefined
    });
  } catch (error) {
    const message =
      error?.issues?.[0]?.message ||
      error?.message ||
      "Something went wrong while submitting the release.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
