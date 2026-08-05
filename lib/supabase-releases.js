import { getAdminView } from "@/lib/admin-views";
import { getSupabaseAdmin } from "@/lib/supabase";
import { UNIFIED_TABLE } from "@/lib/unified-mapping";

const PAGE_SIZE = 50;

// Every admin query is scoped to release-schedule rows; the unified table also
// holds OpenPlay artists/tracks/works/etc.
const SCOPE_FILTERS = [{ col: "source_collection", op: "eq", value: "release_schedule" }];

function resolveFilterValue(value) {
  return typeof value === "function" ? value() : value;
}

function quoteForIn(values) {
  return `(${values.map((value) => `"${value}"`).join(",")})`;
}

function applyFilter(query, filter) {
  const value = resolveFilterValue(filter.value);

  switch (filter.op) {
    case "eq":
      return query.eq(filter.col, value);
    case "neq":
      return query.neq(filter.col, value);
    case "gt":
      return query.gt(filter.col, value);
    case "gte":
      return query.gte(filter.col, value);
    case "lt":
      return query.lt(filter.col, value);
    case "lte":
      return query.lte(filter.col, value);
    case "in":
      return query.in(filter.col, value);
    case "not.in":
      return query.not(filter.col, "in", quoteForIn(value));
    case "is":
      return query.is(filter.col, value);
    case "not.is":
      return query.not(filter.col, "is", value);
    case "contains":
      return query.contains(filter.col, value);
    case "overlaps":
      return query.overlaps(filter.col, value);
    case "notEmpty":
      return query.not(filter.col, "is", null).neq(filter.col, "");
    case "empty":
      return query.or(`${filter.col}.is.null,${filter.col}.eq.""`);
    default:
      throw new Error(`Unknown view filter op: ${filter.op}`);
  }
}

function escapeSearchTerm(term) {
  return term.replace(/[%_,()"]/g, " ").trim();
}

export async function listReleases({ view, q = "", month = "", page = 1 } = {}) {
  const supabase = getSupabaseAdmin();
  const viewDefinition = getAdminView(view);

  let query = supabase.from(UNIFIED_TABLE).select("*", { count: "exact" });

  for (const filter of [...SCOPE_FILTERS, ...viewDefinition.filters]) {
    query = applyFilter(query, filter);
  }

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, monthNumber] = month.split("-").map(Number);
    const start = `${month}-01`;
    const nextMonth =
      monthNumber === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(monthNumber + 1).padStart(2, "0")}-01`;

    query = query.gte("release_date->>start", start).lt("release_date->>start", nextMonth);
  }

  const searchTerm = escapeSearchTerm(String(q || ""));

  if (searchTerm) {
    query = query.or(
      `release_title.ilike.%${searchTerm}%,display_artist.ilike.%${searchTerm}%,label_name.ilike.%${searchTerm}%`
    );
  }

  const sort = viewDefinition.sort || { col: "release_date->>start", dir: "desc" };

  query = query.order(sort.col, {
    ascending: sort.dir === "asc",
    nullsFirst: false
  });

  const pageNumber = Math.max(1, Number(page) || 1);
  const from = (pageNumber - 1) * PAGE_SIZE;

  query = query.range(from, from + PAGE_SIZE - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return {
    rows: data || [],
    total: count || 0,
    page: pageNumber,
    pageSize: PAGE_SIZE
  };
}

export async function getRelease(id) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from(UNIFIED_TABLE)
    .select("*")
    .eq("unified_record_id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function createRelease(row) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from(UNIFIED_TABLE)
    .insert(row)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateRelease(id, patch) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from(UNIFIED_TABLE)
    .update(patch)
    .eq("unified_record_id", id)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
