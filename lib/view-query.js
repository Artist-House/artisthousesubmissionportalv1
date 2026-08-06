import {
  getViewProperty,
  propertyQueryPath,
  VALUELESS_OPERATORS
} from "@/lib/admin-properties";
import { getSupabaseAdmin } from "@/lib/supabase";
import { UNIFIED_TABLE } from "@/lib/unified-mapping";

// Translates a saved view's configuration (filters with AND/OR, multi-sorts)
// into a PostgREST query against the unified table. Views are presentation
// only — this module never writes.

const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 500;

function sanitizeLogicValue(value) {
  // Values embedded in or() logic strings: strip characters that would break
  // the PostgREST grammar, then quote.
  return `"${String(value).replace(/["\\,()]/g, " ").trim()}"`;
}

// Returns a PostgREST logic-string condition for one rule, or null if invalid.
function ruleToCondition(rule) {
  const property = getViewProperty(rule?.property);

  if (!property || !rule.op) {
    return null;
  }

  const path = propertyQueryPath(property);
  const needsValue = !VALUELESS_OPERATORS.has(rule.op);
  const value = String(rule.value ?? "").trim();

  if (needsValue && !value) {
    return null;
  }

  switch (rule.op) {
    case "contains":
      if (property.type === "multiselect") {
        return `${path}.cs.{${sanitizeLogicValue(value)}}`;
      }
      return `${path}.ilike.*${value.replace(/["\\,()*]/g, " ").trim()}*`;
    case "not_contains":
      if (property.type === "multiselect") {
        return `${path}.not.cs.{${sanitizeLogicValue(value)}}`;
      }
      return `${path}.not.ilike.*${value.replace(/["\\,()*]/g, " ").trim()}*`;
    case "is":
      return `${path}.eq.${sanitizeLogicValue(value)}`;
    case "is_not":
      return `${path}.neq.${sanitizeLogicValue(value)}`;
    case "is_empty":
      if (property.type === "multiselect" || property.type === "relation") {
        return `or(${property.key}.is.null,${property.key}.eq.{})`;
      }
      if (["date", "formula-date", "formula"].includes(property.type)) {
        return `${property.key}.is.null`;
      }
      return `or(${path}.is.null,${path}.eq."")`;
    case "is_not_empty":
      if (property.type === "multiselect" || property.type === "relation") {
        return `and(${property.key}.not.is.null,${property.key}.neq.{})`;
      }
      if (["date", "formula-date", "formula"].includes(property.type)) {
        return `${property.key}.not.is.null`;
      }
      return `and(${path}.not.is.null,${path}.neq."")`;
    case "is_checked":
      return `${path}.is.true`;
    case "is_unchecked":
      return `or(${path}.is.false,${path}.is.null)`;
    case "is_before":
      return `${path}.lt.${sanitizeLogicValue(value)}`;
    case "is_after":
      return `${path}.gt.${sanitizeLogicValue(value)}`;
    case "is_on_or_before":
      return `${path}.lte.${sanitizeLogicValue(value)}`;
    case "is_on_or_after":
      return `${path}.gte.${sanitizeLogicValue(value)}`;
    default:
      return null;
  }
}

export async function queryReleases({
  config = {},
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  q = "",
  month = "",
  monthProperty = "release_date"
} = {}) {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from(UNIFIED_TABLE)
    .select("*", { count: "exact" })
    .eq("source_collection", "release_schedule");

  const rules = Array.isArray(config?.filters?.rules) ? config.filters.rules : [];
  const conditions = rules.map(ruleToCondition).filter(Boolean);
  const combinator = config?.filters?.combinator === "or" ? "or" : "and";

  if (conditions.length) {
    if (combinator === "or") {
      query = query.or(conditions.join(","));
    } else {
      for (const condition of conditions) {
        // Chained .or() calls are ANDed together, so wrapping each condition
        // keeps nested or()/and() conditions working under the AND combinator.
        query = query.or(condition);
      }
    }
  }

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const property = getViewProperty(monthProperty) || getViewProperty("release_date");
    const path = propertyQueryPath(property);
    const [year, monthNumber] = month.split("-").map(Number);
    const nextMonth =
      monthNumber === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(monthNumber + 1).padStart(2, "0")}-01`;

    query = query.gte(path, `${month}-01`).lt(path, nextMonth);
  }

  const searchTerm = String(q || "").replace(/[%_,()"]/g, " ").trim();

  if (searchTerm) {
    query = query.or(
      `release_title.ilike.%${searchTerm}%,display_artist.ilike.%${searchTerm}%,label_name.ilike.%${searchTerm}%`
    );
  }

  const sorts = Array.isArray(config?.sorts) && config.sorts.length
    ? config.sorts
    : [{ property: "release_date", dir: "desc" }];

  for (const sort of sorts) {
    const property = getViewProperty(sort?.property);

    if (!property) {
      continue;
    }

    query = query.order(propertyQueryPath(property), {
      ascending: sort.dir === "asc",
      nullsFirst: false
    });
  }

  const effectivePageSize = Math.min(Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const pageNumber = Math.max(1, Number(page) || 1);
  const from = (pageNumber - 1) * effectivePageSize;

  query = query.range(from, from + effectivePageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return {
    rows: data || [],
    total: count || 0,
    page: pageNumber,
    pageSize: effectivePageSize
  };
}
