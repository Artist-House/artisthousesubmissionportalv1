import ReleasesTable from "@/components/admin/releases-table";
import { DEFAULT_ADMIN_VIEW } from "@/lib/admin-views";

export default async function AdminReleasesPage({ searchParams }) {
  const params = await searchParams;

  return (
    <ReleasesTable
      initialView={params?.view || DEFAULT_ADMIN_VIEW}
      initialQuery={params?.q || ""}
      initialPage={Number(params?.page) || 1}
    />
  );
}
