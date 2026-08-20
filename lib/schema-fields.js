import "server-only";

import { addReleaseScheduleProperty } from "@/lib/notion";
import { getSupabaseAdmin, withClient } from "@/lib/supabase";

// Portal-driven schema evolution and field resolution.
//
// The release_schedule_notion_schema table is the single source of truth for
// Notion property <-> Supabase column mappings: the mirror sync reads it, and
// fields added here flow to the Notion DB, all three Supabase tables
// (release_schedule, notion_datatable, unified), and that map — so both
// databases stay in step and the new field syncs from then on.

const SCHEMA_TABLE = "release_schedule_notion_schema";
const DATA_TABLES = ["release_schedule", "notion_datatable", "unified"];

// Field types the portal can create. Notion's API cannot create `status`
// properties — offer `select` instead.
export const CREATABLE_FIELD_TYPES = {
  text: { notionType: "rich_text", columnType: "text", notionSchema: { rich_text: {} } },
  checkbox: { notionType: "checkbox", columnType: "boolean", notionSchema: { checkbox: {} } },
  date: { notionType: "date", columnType: "jsonb", notionSchema: { date: {} } },
  select: { notionType: "select", columnType: "text", notionSchema: null },
  multi_select: { notionType: "multi_select", columnType: "ARRAY", notionSchema: null },
  url: { notionType: "url", columnType: "text", notionSchema: { url: {} } },
  number: { notionType: "number", columnType: "numeric", notionSchema: { number: { format: "number" } } }
};

const NOTION_TYPE_TO_VIEW_TYPE = {
  checkbox: "checkbox",
  rich_text: "text",
  title: "text",
  date: "date",
  select: "select",
  status: "select",
  multi_select: "multiselect",
  url: "url",
  email: "text",
  phone_number: "text",
  number: "text",
  formula: "formula",
  relation: "relation",
  files: "relation"
};

const VIEW_TYPE_TO_RENDER = {
  checkbox: "check",
  date: "notion-date",
  select: "badge",
  multiselect: "tags",
  url: "url",
  formula: "notion-formula",
  relation: "relation",
  text: "text"
};

let fieldMapCache = { at: 0, rows: [] };

export async function loadFieldMap({ fresh = false } = {}) {
  if (!fresh && Date.now() - fieldMapCache.at < 60000 && fieldMapCache.rows.length) {
    return fieldMapCache.rows;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from(SCHEMA_TABLE).select("*");

  if (error) {
    throw new Error(error.message);
  }

  fieldMapCache = { at: Date.now(), rows: data || [] };

  return fieldMapCache.rows;
}

export function fieldToViewProperty(row) {
  const type = NOTION_TYPE_TO_VIEW_TYPE[row.notion_property_type] || "text";
  const schema = row.notion_property_schema || {};
  const options = (schema.select?.options || schema.multi_select?.options || schema.status?.options || [])
    .map((option) => option?.name)
    .filter(Boolean);

  return {
    key: row.supabase_column_name,
    label: row.notion_property_name,
    type,
    render: VIEW_TYPE_TO_RENDER[type] || "text",
    options: options.length ? options : undefined,
    notionPropertyName: row.notion_property_name,
    notionPropertyType: row.notion_property_type
  };
}

export async function resolveFieldByColumn(column) {
  const rows = await loadFieldMap();
  const row = rows.find((candidate) => candidate.supabase_column_name === column);

  return row ? fieldToViewProperty(row) : null;
}

function slugifyColumnName(name) {
  const slug = String(name)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "f$1");

  return slug || "field";
}

export async function addField({ name, type, options = [] }) {
  const trimmedName = String(name || "").trim();
  const definition = CREATABLE_FIELD_TYPES[type];

  if (!trimmedName) {
    throw new Error("Field name is required.");
  }

  if (!definition) {
    throw new Error(`Unsupported field type: ${type}.`);
  }

  const rows = await loadFieldMap({ fresh: true });

  if (rows.some((row) => row.notion_property_name.toLowerCase() === trimmedName.toLowerCase())) {
    throw new Error(`A field named "${trimmedName}" already exists.`);
  }

  let column = slugifyColumnName(trimmedName);

  if (rows.some((row) => row.supabase_column_name === column)) {
    column = `${column}_2`;
  }

  // 1) Create the property in the Notion release schedule DB.
  const notionSchema =
    definition.notionSchema ||
    (type === "select"
      ? { select: { options: options.map((option) => ({ name: option })) } }
      : { multi_select: { options: options.map((option) => ({ name: option })) } });

  const created = await addReleaseScheduleProperty(trimmedName, notionSchema);

  // 2) Add the column to every mirror table.
  const sqlType =
    definition.columnType === "ARRAY" ? "text[]" : definition.columnType === "jsonb" ? "jsonb" : definition.columnType;

  await withClient(async (client) => {
    for (const table of DATA_TABLES) {
      await client.query(`alter table public.${table} add column if not exists "${column}" ${sqlType}`);
    }

    // 3) Register the mapping so the mirror sync carries the field forever.
    await client.query(
      `insert into public.${SCHEMA_TABLE}
         (notion_property_id, notion_property_name, notion_property_type, supabase_column_name, supabase_column_type, notion_property_schema)
       values ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        created?.id || trimmedName,
        trimmedName,
        definition.notionType,
        column,
        definition.columnType === "ARRAY" ? "ARRAY" : definition.columnType,
        JSON.stringify(created || notionSchema)
      ]
    );
  });

  fieldMapCache = { at: 0, rows: [] };

  return { name: trimmedName, column, type: definition.notionType };
}
