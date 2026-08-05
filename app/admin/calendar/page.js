import AdminCalendar from "@/components/admin/calendar";

export default async function AdminCalendarPage({ searchParams }) {
  const params = await searchParams;

  return <AdminCalendar initialMonth={params?.month || ""} />;
}
