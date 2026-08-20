import { NextResponse } from "next/server";
import { readAdminSessionFromRequest } from "@/lib/admin-auth";
import {
  addField,
  CREATABLE_FIELD_TYPES,
  fieldToViewProperty,
  loadFieldMap
} from "@/lib/schema-fields";

export const runtime = "nodejs";

export async function GET(request) {
  const session = await readAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const rows = await loadFieldMap();

    return NextResponse.json({ ok: true, fields: rows.map(fieldToViewProperty) });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Could not load the schema." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const session = await readAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!CREATABLE_FIELD_TYPES[body?.type]) {
      return NextResponse.json({ error: "Unsupported field type." }, { status: 400 });
    }

    const options = Array.isArray(body?.options)
      ? body.options.map((option) => String(option).trim()).filter(Boolean)
      : [];

    const result = await addField({ name: body?.name, type: body.type, options });

    return NextResponse.json({ ok: true, field: result });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Could not add the field." },
      { status: 400 }
    );
  }
}
