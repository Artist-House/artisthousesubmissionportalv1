import { notFound } from "next/navigation";
import ReleaseDetail from "@/components/admin/release-detail";
import { getRelease } from "@/lib/supabase-releases";
import { deriveKindFromRow } from "@/lib/unified-mapping";

export default async function AdminReleaseDetailPage({ params }) {
  const { id } = await params;

  let row = null;

  try {
    row = await getRelease(decodeURIComponent(id));
  } catch {
    row = null;
  }

  if (!row) {
    notFound();
  }

  return <ReleaseDetail row={row} kind={deriveKindFromRow(row)} />;
}
