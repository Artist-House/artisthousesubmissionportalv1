import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

const ADMIN_EMAIL_PATTERN = /@artisthouse\.world$/i;

export function isAdminEmail(email) {
  return ADMIN_EMAIL_PATTERN.test(String(email || "").trim());
}

function toAdminSession(session) {
  if (!session?.authorized || !isAdminEmail(session.email)) {
    return null;
  }

  return session;
}

export async function readAdminSessionFromRequest(request) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await readSessionToken(token);

  return toAdminSession(session);
}

export async function readAdminSessionFromCookieStore(cookieStore) {
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await readSessionToken(token);

  return toAdminSession(session);
}
