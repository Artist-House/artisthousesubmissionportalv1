import NewRelease from "@/components/admin/new-release";

export default async function AdminNewReleasePage({ searchParams }) {
  const params = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params?.date || "") ? params.date : "";

  return <NewRelease initialDate={date} />;
}
