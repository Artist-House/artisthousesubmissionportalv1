import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { readAdminSessionFromCookieStore } from "@/lib/admin-auth";
import SignOutButton from "@/components/admin/sign-out-button";
import "./admin.css";

export const metadata = {
  title: "Artist House Beacon Admin"
};

export default async function AdminLayout({ children }) {
  const cookieStore = await cookies();
  const session = await readAdminSessionFromCookieStore(cookieStore);

  if (!session) {
    redirect("/");
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header__brand">
          <Link href="/admin/releases?view=upcoming" className="admin-header__title">
            Artist House <span>Beacon Admin</span>
          </Link>
        </div>
        <nav className="admin-header__nav">
          <Link href="/admin/releases?view=upcoming">Releases</Link>
          <Link href="/admin/calendar">Calendar</Link>
          <Link href="/admin/allowed-users">Allowed Users</Link>
          <Link href="/admin/releases/new" className="admin-header__new">
            + New Submission
          </Link>
        </nav>
        <div className="admin-header__meta">
          <span className="admin-header__user">{session.email}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
