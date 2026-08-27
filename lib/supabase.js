import "server-only";

import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";

// Mirrors Notion Release Schedule pages into the Supabase `release_schedule`
// table. The Notion property -> Supabase column mapping is not hardcoded: it is
// read from `release_schedule_notion_schema`, the same table the original
// migration wrote, so renamed or added Notion properties keep syncing.
//
// Writes run with `automation.context = 'import'`, which the
// release_schedule automation trigger checks to skip its rules. Notion is the
// source of truth and runs those automations itself; without this the mirror
// would fire a duplicate set of notifications and page initializations.

const RELEASE_TABLE = "public.release_schedule";
const UNIFIED_TABLE = "public.unified";
const NOTION_STAGING_TABLE = "public.notion_datatable";
const SCHEMA_TABLE = "public.release_schedule_notion_schema";

// Columns on `unified` owned by the Notion<->OpenPlay matching process. They are
// seeded when a Notion page first appears and then left alone, so re-syncing
// release data never discards a match the matcher computed.
const UNIFIED_MATCH_COLUMNS = [
  "matched_notion_page_id",
  "matched_release_notion_page_id",
  "matched_track_notion_page_id",
  "unified_match_status",
  "unified_match_score"
];

const META_COLUMNS = {
  notion_page_id: "text",
  notion_url: "text",
  notion_public_url: "text",
  notion_created_time: "text",
  notion_last_edited_time: "text",
  notion_archived: "boolean",
  notion_in_trash: "boolean",
  notion_icon: "jsonb",
  notion_cover: "jsonb",
  notion_properties_raw: "jsonb",
  notion_page_raw: "jsonb"
};

function getConnectionString() {
  const raw = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || "";

  // pg honours sslmode from the URL and then rejects Supabase's self-signed
  // chain, so strip it and pass ssl options explicitly instead.
  return raw.replace(/[?&]sslmode=[^&]*/g, "");
}

export function isSupabaseConfigured() {
  return Boolean(getConnectionString());
}

export async function withClient(run) {
  const connectionString = getConnectionString();

  if (!connectionString) {
    throw new Error("Supabase Postgres connection is not configured.");
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 120000
  });

  await client.connect();

  try {
    return await run(client);
  } finally {
    await client.end().catch(() => {});
  }
}

async function loadSchemaMap(client) {
  const { rows } = await client.query(
    `select notion_property_id, notion_property_name, supabase_column_name, supabase_column_type from ${SCHEMA_TABLE}`
  );

  const byName = new Map();
  const byId = new Map();

  for (const row of rows) {
    if (!row.supabase_column_name) {
      continue;
    }

    const mapping = { column: row.supabase_column_name, columnType: row.supabase_column_type };

    if (row.notion_property_name) {
      byName.set(row.notion_property_name, mapping);
    }

    if (row.notion_property_id) {
      byId.set(row.notion_property_id, mapping);
    }
  }

  // Property ids survive renames in Notion, so id lookup keeps a renamed
  // property syncing into the same column ("Display Artist" -> "artist").
  return {
    get(propertyName, property) {
      return byName.get(propertyName) || (property?.id ? byId.get(property.id) : undefined);
    }
  };
}

function plainText(items = []) {
  return items.map((item) => item.plain_text).join("");
}

// Converts one Notion property value into the shape its Supabase column holds,
// matching what the original migration stored (dates/files/formulas as raw
// jsonb, multi-selects and relations as arrays, checkboxes as booleans).
function toColumnValue(property, columnType) {
  if (!property) {
    return null;
  }

  switch (property.type) {
    case "title":
      return plainText(property.title);
    case "rich_text":
      return plainText(property.rich_text);
    case "select":
      return property.select?.name ?? null;
    case "status":
      return property.status?.name ?? null;
    case "multi_select":
      return property.multi_select.map((item) => item.name);
    case "checkbox":
      return Boolean(property.checkbox);
    case "url":
      return property.url ?? null;
    case "email":
      return property.email ?? null;
    case "phone_number":
      return property.phone_number ?? null;
    case "number":
      return property.number ?? null;
    case "date":
      return property.date ?? null;
    case "files":
      return property.files ?? [];
    case "relation":
      return property.relation.map((item) => item.id);
    case "people":
      return columnType === "jsonb" ? property.people : property.people.map((item) => item.id);
    case "formula":
      return property.formula ?? null;
    case "rollup":
      return property.rollup ?? null;
    case "created_time":
      return property.created_time ?? null;
    case "last_edited_time":
      return property.last_edited_time ?? null;
    case "created_by":
      return property.created_by ?? null;
    case "last_edited_by":
      return property.last_edited_by ?? null;
    case "unique_id":
      return property.unique_id ? `${property.unique_id.prefix || ""}${property.unique_id.number}` : null;
    default:
      return columnType === "jsonb" ? property : null;
  }
}

export function mapNotionPageToRow(page, schemaMap) {
  const values = {
    notion_page_id: page.id,
    notion_url: page.url ?? null,
    notion_public_url: page.public_url ?? null,
    notion_created_time: page.created_time ?? null,
    notion_last_edited_time: page.last_edited_time ?? null,
    notion_archived: Boolean(page.archived),
    notion_in_trash: Boolean(page.in_trash),
    notion_icon: page.icon ?? null,
    notion_cover: page.cover ?? null,
    notion_properties_raw: page.properties ?? {},
    notion_page_raw: page
  };

  const types = { ...META_COLUMNS };

  for (const [propertyName, property] of Object.entries(page.properties || {})) {
    const mapping = schemaMap.get(propertyName, property);

    if (!mapping?.column || mapping.column in META_COLUMNS) {
      continue;
    }

    values[mapping.column] = toColumnValue(property, mapping.columnType);
    types[mapping.column] = mapping.columnType;
  }

  return { values, types };
}

function toParam(value, columnType) {
  if (value === undefined) {
    return null;
  }

  if (columnType === "jsonb") {
    return value === null ? null : JSON.stringify(value);
  }

  return value;
}

async function upsertInto(client, table, conflictColumn, { values, types }, preserveColumns = []) {
  const columns = Object.keys(values);
  const params = columns.map((column) => toParam(values[column], types[column]));
  const placeholders = columns.map((column, index) => {
    const cast = types[column] === "jsonb" ? "::jsonb" : "";
    return `$${index + 1}${cast}`;
  });
  const updates = columns
    .filter((column) => column !== conflictColumn && !preserveColumns.includes(column))
    .map((column) => `"${column}" = excluded."${column}"`);

  const sql = `
    insert into ${table} (${columns.map((column) => `"${column}"`).join(", ")})
    values (${placeholders.join(", ")})
    on conflict (${conflictColumn}) do update set ${updates.join(", ")}
  `;

  await client.query(sql, params);
}

// `unified` holds one row per source record across Notion and OpenPlay. Notion
// rows follow the convention set by the original migration: a "notion:<page id>"
// key, self-referencing match ids, and the raw page in source_raw.
function buildUnifiedRow(page, { values, types }) {
  return {
    values: {
      ...values,
      unified_record_id: `notion:${page.id}`,
      source_system: "notion",
      source_collection: "release_schedule",
      source_record_id: page.id,
      source_backup_id: null,
      source_raw: page,
      matched_notion_page_id: page.id,
      matched_release_notion_page_id: page.id,
      matched_track_notion_page_id: page.id,
      unified_match_status: "unmatched",
      unified_match_score: null
    },
    types: {
      ...types,
      unified_record_id: "text",
      source_system: "text",
      source_collection: "text",
      source_record_id: "text",
      source_backup_id: "text",
      source_raw: "jsonb",
      matched_notion_page_id: "text",
      matched_release_notion_page_id: "text",
      matched_track_notion_page_id: "text",
      unified_match_status: "text",
      unified_match_score: "numeric"
    }
  };
}

export async function syncNotionPagesToSupabase(pages) {
  if (!pages.length) {
    return { synced: 0, unifiedSynced: 0, failed: [] };
  }

  return withClient(async (client) => {
    const schemaMap = await loadSchemaMap(client);
    const failed = [];
    let synced = 0;

    let unifiedSynced = 0;

    for (const page of pages) {
      try {
        const mapped = mapNotionPageToRow(page, schemaMap);

        await client.query("begin");
        // Transaction-local, so the automation trigger stays armed for real
        // application writes made by anything else.
        await client.query("select set_config('automation.context', 'import', true)");
        await upsertInto(client, RELEASE_TABLE, "notion_page_id", mapped);
        // Staging table that feeds `unified`, kept in step so the pipeline's
        // Notion side never lags the mirror.
        await upsertInto(client, NOTION_STAGING_TABLE, "source_record_key", {
          values: { ...mapped.values, source_record_key: `notion:${page.id}` },
          types: { ...mapped.types, source_record_key: "text" }
        });
        await upsertInto(
          client,
          UNIFIED_TABLE,
          "unified_record_id",
          buildUnifiedRow(page, mapped),
          UNIFIED_MATCH_COLUMNS
        );
        await client.query("commit");
        synced += 1;
        unifiedSynced += 1;
      } catch (error) {
        await client.query("rollback").catch(() => {});
        failed.push({ pageId: page.id, message: error?.message || String(error) });
      }
    }

    return { synced, unifiedSynced, failed };
  });
}

export async function getMirrorCounts() {
  return withClient(async (client) => {
    const { rows } = await client.query(`
      select
        (select count(*) from ${RELEASE_TABLE}) as release_schedule,
        (select count(*) from ${NOTION_STAGING_TABLE}) as notion_datatable,
        (select count(*) from ${UNIFIED_TABLE} where source_system = 'notion') as unified_notion,
        (select count(*) from ${UNIFIED_TABLE} where source_system = 'openplay') as unified_openplay,
        (select count(*) from ${RELEASE_TABLE} rs where not exists (
           select 1 from ${UNIFIED_TABLE} u
           where u.source_system = 'notion' and u.source_record_id = rs.notion_page_id::text
         )) as missing_from_unified,
        (select count(*) from ${RELEASE_TABLE} rs where not exists (
           select 1 from ${NOTION_STAGING_TABLE} nd
           where nd.notion_page_id = rs.notion_page_id
         )) as missing_from_staging
    `);

    return rows[0];
  });
}

export async function getRecentMirroredRows(limit = 5) {
  return withClient(async (client) => {
    const { rows } = await client.query(
      `
      select rs.release_title, rs.display_artist, rs.status, rs.submitters_email,
             rs.type_of_release_audio, rs.type_of_release_video, rs.publishing_tag,
             rs.notion_created_time, rs.notion_last_edited_time,
             exists (select 1 from ${NOTION_STAGING_TABLE} nd where nd.notion_page_id = rs.notion_page_id) as in_staging,
             exists (select 1 from ${UNIFIED_TABLE} u
                     where u.source_system = 'notion' and u.source_record_id = rs.notion_page_id::text) as in_unified
      from ${RELEASE_TABLE} rs
      order by rs.notion_created_time desc nulls last
      limit $1
      `,
      [limit]
    );

    return rows;
  });
}

// Supabase JS client with the service-role key — used by the internal admin
// portal to read the unified table (RLS bypass; server-only by construction).
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

// Never let a mirror failure break a submission: the portal's source of truth is
// Notion, and a full re-sync can repair any row this misses.
export async function syncNotionPageSafely(page) {
  if (!isSupabaseConfigured()) {
    console.warn("Supabase is not configured. Skipping mirror for page", page?.id);
    return false;
  }

  try {
    const { synced, failed } = await syncNotionPagesToSupabase([page]);

    if (failed.length) {
      console.error("Supabase mirror failed for page", page?.id, failed[0].message);
      return false;
    }

    console.log("Mirrored Notion page to Supabase:", page.id);
    return synced === 1;
  } catch (error) {
    console.error("Supabase mirror failed for page", page?.id, error);
    return false;
  }
}
