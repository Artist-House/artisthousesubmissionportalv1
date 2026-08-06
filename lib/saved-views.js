import { getSupabaseAdmin } from "@/lib/supabase";

const TABLE = "admin_saved_views";
const LAYOUTS = new Set(["table", "timeline", "chart", "calendar", "dashboard"]);

export function isValidLayout(layout) {
  return LAYOUTS.has(layout);
}

export async function listSavedViews() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getSavedView(id) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from(TABLE).select("*").eq("id", id).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function createSavedView({ name, layout, config, createdBy }) {
  const supabase = getSupabaseAdmin();

  const { data: last, error: positionError } = await supabase
    .from(TABLE)
    .select("position")
    .order("position", { ascending: false })
    .limit(1);

  if (positionError) {
    throw new Error(positionError.message);
  }

  const position = last?.length ? (last[0].position || 0) + 1 : 0;

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ name, layout, config, position, created_by: createdBy || null })
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateSavedView(id, patch) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteSavedView(id) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from(TABLE).delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function reorderSavedViews(orderedIds) {
  const supabase = getSupabaseAdmin();

  for (let index = 0; index < orderedIds.length; index += 1) {
    const { error } = await supabase
      .from(TABLE)
      .update({ position: index })
      .eq("id", orderedIds[index]);

    if (error) {
      throw new Error(error.message);
    }
  }
}
