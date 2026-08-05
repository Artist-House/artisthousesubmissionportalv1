import { createClient } from "@supabase/supabase-js";

let adminClient = null;

export function getSupabaseAdmin() {
  if (!adminClient) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        "Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
      );
    }

    adminClient = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return adminClient;
}
