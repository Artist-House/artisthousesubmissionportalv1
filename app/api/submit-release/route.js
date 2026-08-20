import { NextResponse } from "next/server";
import {
  createPublishingSubmission,
  createReleaseSubmission,
  createVideoSubmission,
  getReleaseSubmissionById,
  updatePublishingSubmission,
  updateReleaseSubmission,
  updateVideoSubmission
} from "@/lib/notion";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";
import { publishingPayloadSchema, releasePayloadSchema, videoPayloadSchema } from "@/lib/validation";
import {
  diffPublishingValues,
  diffReleaseValues,
  diffVideoValues,
  FORM_KIND_LABELS,
  getMissingFields,
  getMissingFieldsForMatch
} from "@/lib/release-fields";
import { sendSubmissionNotificationEmail } from "@/lib/email";
import { syncNotionPageSafely } from "@/lib/supabase";
import { ASSET_KINDS, attachAssetsToPage, recordAsset } from "@/lib/storage";
import { INTERNAL_EMAIL_DOMAIN, normalizeDistributor } from "@/lib/release-config";

export const runtime = "nodejs";

function isInternalEmail(email) {
  return String(email || "").trim().toLowerCase().endsWith(INTERNAL_EMAIL_DOMAIN);
}

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

    const rawPayload = JSON.parse(payloadText);
    const formKind = ["publishing", "video"].includes(rawPayload.formKind) ? rawPayload.formKind : "release";

    if (formKind === "publishing" && !isInternalEmail(session.email)) {
      return NextResponse.json(
        { error: "Publishing submissions are limited to Artist House team members." },
        { status: 403 }
      );
    }

    const lyricsFile = formData.get("lyricsFile");
    const coverArtFile = formData.get("coverArtFile");
    const thumbnailFile = formData.get("thumbnailFile");

    const filePayload = {
      lyricsFile: lyricsFile instanceof File ? lyricsFile : null,
      coverArtFile: coverArtFile instanceof File ? coverArtFile : null,
      thumbnailFile: thumbnailFile instanceof File ? thumbnailFile : null
    };

    // Files were uploaded straight to Supabase Storage by the browser; the
    // payload only carries their references. Record them first so each gets an
    // id, then hand Notion a durable permalink instead of an expiring URL.
    const uploadedAssets = Array.isArray(rawPayload.assets) ? rawPayload.assets : [];
    const assetLinks = {};

    for (const asset of uploadedAssets) {
      if (!ASSET_KINDS[asset?.kind] || !asset?.storagePath) {
        continue;
      }

      const recorded = await recordAsset({
        submissionId: rawPayload.submissionId,
        kind: asset.kind,
        storagePath: asset.storagePath,
        fileName: asset.fileName || "file",
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        uploadedBy: session.email || ""
      });

      const field = ASSET_KINDS[asset.kind].notionUrlField;

      if (field) {
        assetLinks[field] = `${request.nextUrl.origin}/api/assets/${recorded.asset_id}/download`;
      }
    }

    Object.assign(rawPayload, assetLinks);

    let normalizedPayload;

    if (formKind === "publishing") {
      normalizedPayload = publishingPayloadSchema.parse(rawPayload);
    } else if (formKind === "video") {
      normalizedPayload = videoPayloadSchema.parse(rawPayload);
    } else {
      normalizedPayload = {
        ...releasePayloadSchema.parse(rawPayload),
        dealTags: ["Distribution Only"],
        distributor: normalizeDistributor("Fuga")
      };
    }

    const isUpdate = Boolean(normalizedPayload.pageId);
    const previousSubmission = isUpdate
      ? (await getReleaseSubmissionById(normalizedPayload.pageId)).mapped
      : null;
    const previousValues = previousSubmission?.formValues || {};
    const previousAssets = previousSubmission?.existingAssets || {};

    let createdPage;

    if (formKind === "publishing") {
      createdPage = isUpdate
        ? await updatePublishingSubmission(normalizedPayload.pageId, normalizedPayload, filePayload, session)
        : await createPublishingSubmission(normalizedPayload, filePayload, session);
    } else if (formKind === "video") {
      createdPage = isUpdate
        ? await updateVideoSubmission(normalizedPayload.pageId, normalizedPayload, filePayload, session)
        : await createVideoSubmission(normalizedPayload, filePayload, session);
    } else {
      createdPage = isUpdate
        ? await updateReleaseSubmission(normalizedPayload.pageId, normalizedPayload, filePayload, session)
        : await createReleaseSubmission(normalizedPayload, filePayload, session);
    }

    if (rawPayload.submissionId && uploadedAssets.length) {
      try {
        await attachAssetsToPage(rawPayload.submissionId, createdPage.id);
      } catch (error) {
        console.error("Could not link assets to page", createdPage.id, error);
      }
    }

    await syncNotionPageSafely(createdPage);

    try {
      const changes =
        formKind === "publishing"
          ? diffPublishingValues(previousValues, normalizedPayload)
          : formKind === "video"
            ? diffVideoValues(previousValues, normalizedPayload)
            : diffReleaseValues(previousValues, normalizedPayload);

      const uploadedFiles = [
        filePayload.lyricsFile?.name,
        filePayload.coverArtFile?.name,
        filePayload.thumbnailFile?.name
      ].filter(Boolean);

      const missingFields =
        formKind === "release"
          ? getMissingFields({
              releaseType: normalizedPayload.releaseType,
              formValues: normalizedPayload,
              existingAssets: {
                lyrics: Boolean(filePayload.lyricsFile) || Boolean(previousAssets.lyrics),
                coverArt: Boolean(filePayload.coverArtFile) || Boolean(previousAssets.coverArt)
              }
            })
          : getMissingFieldsForMatch({
              kind: formKind,
              formValues: normalizedPayload,
              existingAssets: {
                lyrics: Boolean(filePayload.lyricsFile) || Boolean(previousAssets.lyrics),
                coverArt: Boolean(filePayload.coverArtFile) || Boolean(previousAssets.coverArt),
                thumbnail: Boolean(filePayload.thumbnailFile) || Boolean(previousAssets.thumbnail)
              }
            });

      if (!isUpdate || changes.length || uploadedFiles.length) {
        await sendSubmissionNotificationEmail({
          action: isUpdate ? "update" : "create",
          submitterEmail: session.email || "",
          submitterName: session.name || "",
          title: normalizedPayload.title,
          releaseType: normalizedPayload.releaseType,
          kindLabel: FORM_KIND_LABELS[formKind] || "",
          changes,
          uploadedFiles,
          missingFields
        });
      }
    } catch (error) {
      console.error("Submission notification email failed:", error);
    }

    return NextResponse.json({
      ok: true,
      pageId: createdPage.id
    });
  } catch (error) {
    const message =
      error?.issues?.[0]?.message ||
      error?.message ||
      "Something went wrong while submitting the release.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
