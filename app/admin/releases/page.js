import ReleasesWorkspace from "@/components/admin/releases-workspace";
import { DEFAULT_ADMIN_VIEW } from "@/lib/admin-views";
import { listSavedViews } from "@/lib/saved-views";

export default async function AdminReleasesPage({ searchParams }) {
  const params = await searchParams;

  let savedViews = [];

  try {
    savedViews = await listSavedViews();
  } catch {
    savedViews = [];
  }

  return (
    <ReleasesWorkspace
      initialViews={savedViews}
      initialActive={params?.view || DEFAULT_ADMIN_VIEW}
    />
  );
}
