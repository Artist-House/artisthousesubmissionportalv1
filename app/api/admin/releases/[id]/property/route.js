import { NextResponse } from "next/server";
import { readAdminSessionFromRequest } from "@/lib/admin-auth";
import { setNotionProperty } from "@/lib/notion";
import { resolveFieldByColumn } from "@/lib/schema-fields";
import { getRelease } from "@/lib/supabase-releases";
import { syncNotionPageSafely } from "@/lib/supabase";

export const runtime = "nodejs";

// Notion property types that may be edited as a single value from Beacon.
const EDITABLE_TYPES = new Set([
  "checkbox",
  "rich_text",
  "date",
  "select",
  "status",
  "multi_select",
  "url",
  "email",
  "phone_number",
  "number"
]);

// Sets one property on one release — Notion first, then the Supabase mirror.
export async function PATCH(request, { params }) {
  const session = await readAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const row = await getRelease(decodeURIComponent(id));

    if (!row) {
      return NextResponse.json({ error: "Release not found." }, { status: 404 });
    }

    if (!row.notion_page_id) {
      return NextResponse.json(
        { error: "This record has no linked Notion page." },
        { status: 409 }
      );
    }

    const body = await request.json();
    const field = await resolveFieldByColumn(String(body?.column || ""));

    if (!field) {
      return NextResponse.json({ error: "Unknown field." }, { status: 400 });
    }

    if (!EDITABLE_TYPES.has(field.notionPropertyType)) {
      return NextResponse.json(
        { error: `${field.label} can't be edited directly.` },
        { status: 400 }
      );
    }

    const page = await setNotionProperty(
      row.notion_page_id,
      field.notionPropertyName,
      field.notionPropertyType,
      body?.value
    );

    const synced = await syncNotionPageSafely(page);

    return NextResponse.json({ ok: true, syncWarning: !synced });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Could not update the field." },
      { status: 400 }
    );
  }
}
