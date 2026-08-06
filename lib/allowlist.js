import {
  archiveAllowlistUser,
  createAllowlistUser,
  listAllowlistUsers,
  updateAllowlistUser
} from "@/lib/notion";
import { getSupabaseAdmin } from "@/lib/supabase";

// The portal allowlist: Notion users DB is the source of truth (isEmailAllowed
// queries it live on sign-in); every change here is mirrored into the Supabase
// `users` table so the two stay in step. Mirror failures never fail the edit —
// they surface as syncWarning.

const USERS_TABLE = "users";

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function userRowFromPage(page, email) {
  return {
    notion_page_id: page.id,
    notion_url: page.url ?? null,
    notion_public_url: page.public_url ?? null,
    notion_created_time: page.created_time ?? null,
    notion_last_edited_time: page.last_edited_time ?? null,
    notion_archived: Boolean(page.archived || page.is_archived),
    notion_in_trash: Boolean(page.in_trash),
    notion_icon: page.icon ?? null,
    notion_cover: page.cover ?? null,
    notion_properties_raw: page.properties ?? {},
    notion_page_raw: page,
    name: email
  };
}

async function mirrorUpsert(page, email) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from(USERS_TABLE)
      .upsert(userRowFromPage(page, email), { onConflict: "notion_page_id" });

    if (error) {
      throw new Error(error.message);
    }

    return true;
  } catch (error) {
    console.error("Allowlist mirror failed for page", page?.id, error);
    return false;
  }
}

async function mirrorDelete(pageId) {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from(USERS_TABLE).delete().eq("notion_page_id", pageId);

    if (error) {
      throw new Error(error.message);
    }

    return true;
  } catch (error) {
    console.error("Allowlist mirror delete failed for page", pageId, error);
    return false;
  }
}

export async function getAllowlist() {
  const users = await listAllowlistUsers();

  return users.map(({ pageId, email, createdAt, updatedAt }) => ({
    pageId,
    email,
    createdAt,
    updatedAt
  }));
}

export async function addAllowedUser(email) {
  const normalized = normalizeEmail(email);
  const existing = await listAllowlistUsers();

  if (existing.some((user) => normalizeEmail(user.email) === normalized)) {
    throw new Error(`${normalized} is already on the allowlist.`);
  }

  const page = await createAllowlistUser(normalized);
  const synced = await mirrorUpsert(page, normalized);

  return { pageId: page.id, email: normalized, syncWarning: !synced };
}

export async function editAllowedUser(pageId, email) {
  const normalized = normalizeEmail(email);
  const existing = await listAllowlistUsers();

  if (
    existing.some(
      (user) => user.pageId !== pageId && normalizeEmail(user.email) === normalized
    )
  ) {
    throw new Error(`${normalized} is already on the allowlist.`);
  }

  const page = await updateAllowlistUser(pageId, normalized);
  const synced = await mirrorUpsert(page, normalized);

  return { pageId, email: normalized, syncWarning: !synced };
}

export async function removeAllowedUser(pageId) {
  await archiveAllowlistUser(pageId);
  const synced = await mirrorDelete(pageId);

  return { pageId, syncWarning: !synced };
}
