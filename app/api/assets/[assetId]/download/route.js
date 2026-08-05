import { NextResponse } from "next/server";
import { createSignedDownloadUrl, getAssetById } from "@/lib/storage";

export const runtime = "nodejs";

// Durable permalink for a stored file. Supabase signed URLs expire, so this
// redirects to a freshly minted one on every request -- these links are what
// gets written into Notion, and they must not rot.
export async function GET(request, { params }) {
  const { assetId } = await params;

  try {
    const asset = await getAssetById(assetId);

    if (!asset) {
      return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    }

    const signedUrl = await createSignedDownloadUrl(asset.storage_path, 3600);

    return NextResponse.redirect(signedUrl, 302);
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Could not resolve asset." }, { status: 500 });
  }
}
