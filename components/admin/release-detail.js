"use client";

import ReleaseForm from "@/components/admin/release-form";
import RecordExtras from "@/components/admin/record-extras";
import { buildFormValuesFromUnifiedRow } from "@/lib/admin-form-config";

export default function ReleaseDetail({ row, kind }) {
  const initialValues = buildFormValuesFromUnifiedRow(row, kind);

  async function handleSubmit(values) {
    const response = await fetch(`/api/admin/releases/${encodeURIComponent(row.unified_record_id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: values })
    });

    const body = await response.json();

    if (!response.ok) {
      throw new Error(body?.error || "Could not save the release.");
    }

    return body;
  }

  return (
    <>
      <ReleaseForm
        kind={kind}
        initialValues={initialValues}
        onSubmit={handleSubmit}
        backHref="/admin/releases?view=upcoming"
      />
      <RecordExtras row={row} kind={kind} />
    </>
  );
}
