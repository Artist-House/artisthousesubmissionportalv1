import { NextResponse } from "next/server";
import { readAdminSessionFromRequest } from "@/lib/admin-auth";
import { queryReleases } from "@/lib/view-query";

export const runtime = "nodejs";

// Dynamic query endpoint for user-defined saved views. Read-only: it applies a
// view configuration (filters, sorts) to the unified table and returns rows.
export async function POST(request) {
  const session = await readAdminSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();

    const result = await queryReleases({
      config: body?.config || {},
      page: body?.page || 1,
      pageSize: body?.pageSize,
      q: body?.q || "",
      month: body?.month || "",
      monthProperty: body?.monthProperty || "release_date"
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Query failed." }, { status: 400 });
  }
}
