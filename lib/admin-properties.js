import { ENTIRE_DB_COLUMNS } from "@/lib/admin-views";
import { STATUS_OPTIONS } from "@/lib/release-config";

// Property catalog for user-defined saved views: every column of the release
// schedule with a type that drives filter operators, sort paths, and inputs.
//
// Types:
// - text / url        plain text columns
// - select            single-value tag columns (status, publishing_tag, ...)
// - multiselect       text[] columns
// - checkbox          boolean columns
// - date              Notion jsonb dates ({ start, end, time_zone })
// - formula-date      Notion formula wrapping a date ({ type, date: { start } })
// - formula           Notion formula wrapping a string ({ type, string })
// - timestamp         plain timestamptz columns
// - relation          arrays of linked Notion page ids (read-only)

const TYPE_BY_RENDER = {
  link: "text",
  text: "text",
  url: "url",
  badge: "select",
  tags: "multiselect",
  check: "checkbox",
  "notion-date": "date",
  "notion-formula": "formula",
  date: "timestamp",
  relation: "relation"
};

const TYPE_OVERRIDES = {
  assets_due_date: "formula-date"
};

export const VIEW_PROPERTIES = ENTIRE_DB_COLUMNS.map((column) => ({
  key: column.key,
  label: column.label,
  render: column.render || "text",
  type: TYPE_OVERRIDES[column.key] || TYPE_BY_RENDER[column.render || "text"] || "text"
}));

const PROPERTY_MAP = new Map(VIEW_PROPERTIES.map((property) => [property.key, property]));

export function getViewProperty(key) {
  return PROPERTY_MAP.get(key) || null;
}

// SQL path used when filtering/sorting a property (PostgREST arrow syntax for
// the jsonb-wrapped Notion values).
export function propertyQueryPath(property) {
  switch (property.type) {
    case "date":
      return `${property.key}->>start`;
    case "formula-date":
      return `${property.key}->date->>start`;
    case "formula":
      return `${property.key}->>string`;
    default:
      return property.key;
  }
}

export const OPERATORS_BY_TYPE = {
  text: ["contains", "not_contains", "is", "is_not", "is_empty", "is_not_empty"],
  url: ["contains", "not_contains", "is_empty", "is_not_empty"],
  select: ["is", "is_not", "contains", "is_empty", "is_not_empty"],
  multiselect: ["contains", "not_contains", "is_empty", "is_not_empty"],
  checkbox: ["is_checked", "is_unchecked"],
  date: ["is", "is_before", "is_after", "is_on_or_before", "is_on_or_after", "is_empty", "is_not_empty"],
  "formula-date": ["is", "is_before", "is_after", "is_on_or_before", "is_on_or_after", "is_empty", "is_not_empty"],
  formula: ["contains", "not_contains", "is", "is_not"],
  timestamp: ["is_before", "is_after"],
  relation: ["is_empty", "is_not_empty"]
};

export const OPERATOR_LABELS = {
  contains: "contains",
  not_contains: "does not contain",
  is: "is",
  is_not: "is not",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  is_checked: "is checked",
  is_unchecked: "is unchecked",
  is_before: "is before",
  is_after: "is after",
  is_on_or_before: "is on or before",
  is_on_or_after: "is on or after"
};

export const VALUELESS_OPERATORS = new Set([
  "is_empty",
  "is_not_empty",
  "is_checked",
  "is_unchecked"
]);

// Suggested values for filter inputs, keyed by property.
export function propertyValueOptions(property) {
  if (property.key === "status" || property.key === "nmd_status") {
    return STATUS_OPTIONS;
  }

  return null;
}

export function operatorUsesDateInput(property, operator) {
  return (
    ["date", "formula-date", "timestamp"].includes(property.type) &&
    !VALUELESS_OPERATORS.has(operator)
  );
}

// Inline-editable properties in table views: shared across all three
// submission kinds and mapped to the admin payload keys.
export const INLINE_EDITABLE = {
  release_title: { payloadKey: "title", input: "text" },
  display_artist: { payloadKey: "mainArtists", input: "text" },
  release_date: { payloadKey: "releaseDate", input: "date" },
  status: { payloadKey: "status", input: "select", options: STATUS_OPTIONS },
  notes: { payloadKey: "notes", input: "text" }
};

export const VIEW_LAYOUTS = [
  { key: "table", label: "Table" },
  { key: "timeline", label: "Timeline" },
  { key: "chart", label: "Chart" },
  { key: "calendar", label: "Calendar" },
  { key: "dashboard", label: "Dashboard" }
];

export const DEFAULT_VISIBLE_PROPERTIES = [
  "release_title",
  "display_artist",
  "release_date",
  "status",
  "distribution",
  "tags"
];

export function defaultConfigForLayout(layout) {
  const base = {
    visibleProperties: DEFAULT_VISIBLE_PROPERTIES,
    filters: { combinator: "and", rules: [] },
    sorts: [{ property: "release_date", dir: "desc" }],
    groupBy: ""
  };

  switch (layout) {
    case "timeline":
      return { ...base, dateProperty: "release_date", scale: "month" };
    case "calendar":
      return {
        ...base,
        dateProperty: "release_date",
        cardProperties: ["release_title", "status"]
      };
    case "chart":
      return {
        ...base,
        chartType: "bar",
        xProperty: "status",
        yProperty: "",
        aggregation: "count"
      };
    case "dashboard":
      return { widgets: [] };
    default:
      return base;
  }
}
