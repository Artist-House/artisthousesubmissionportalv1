"use client";

import { useEffect, useState } from "react";
import { getViewProperty, VIEW_PROPERTIES } from "@/lib/admin-properties";

// Extra per-record editing below the detail form:
// - Asset checklist: the ✓ checkboxes for this submission type, clickable.
// - Custom fields: values for portal-added fields (dynamic schema).
// Every change writes the single Notion property, then mirrors to Supabase.

const CHECKLISTS_BY_KIND = {
  audio: [
    "cover_art",
    "lyrics",
    "master_audio_file",
    "dolby_atmos_mixs",
    "apple_motion_art_2",
    "product_label_copy",
    "ar_admin_clearance"
  ],
  video: ["music_video_file", "thumbnail", "video_description", "keywords_2"],
  publishing: [
    "curve",
    "disco",
    "mlc",
    "musicmark",
    "ascap",
    "bmi",
    "cmrra",
    "socan",
    "prs",
    "kobalt",
    "spirit",
    "regard",
    "spotify_pub",
    "umpg",
    "music_reports",
    "music_admin"
  ]
};

const STATIC_KEYS = new Set(VIEW_PROPERTIES.map((property) => property.key));

export default function RecordExtras({ row, kind }) {
  const [values, setValues] = useState(row);
  const [dynamicFields, setDynamicFields] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState("");
  const [savingKey, setSavingKey] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/admin/schema");
        const body = await response.json();

        if (!cancelled && response.ok) {
          setDynamicFields((body.fields || []).filter((field) => !STATIC_KEYS.has(field.key)));
        }
      } catch {
        // Custom fields section just stays hidden.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function saveProperty(column, value) {
    setError("");
    setSavingKey(column);

    try {
      const response = await fetch(
        `/api/admin/releases/${encodeURIComponent(row.unified_record_id)}/property`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ column, value })
        }
      );
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error || "Could not save the change.");
      }

      setValues((previous) => ({ ...previous, [column]: value }));
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingKey(null);
    }
  }

  const checklist = (CHECKLISTS_BY_KIND[kind] || [])
    .map((key) => getViewProperty(key))
    .filter(Boolean);

  function dynamicValue(field) {
    if (field.key in drafts) {
      return drafts[field.key];
    }

    const value = values[field.key];

    if (Array.isArray(value)) {
      return value.join(", ");
    }

    if (value && typeof value === "object") {
      return value.start || value.date?.start || value.string || "";
    }

    return value ?? "";
  }

  return (
    <div className="admin-detail admin-record-extras">
      {error ? <div className="admin-banner admin-banner--error">{error}</div> : null}

      <section className="admin-detail__section">
        <div className="admin-detail__section-title">
          {kind === "publishing" ? "Society / Admin Checklist" : "Asset Checklist"}
        </div>
        <div className="admin-record-extras__checks">
          {checklist.map((property) => {
            const checked = Boolean(values[property.key]);

            return (
              <button
                key={property.key}
                type="button"
                className={`admin-record-extras__check${checked ? " is-checked" : ""}`}
                disabled={savingKey === property.key}
                onClick={() => saveProperty(property.key, !checked)}
              >
                <span className={`admin-check ${checked ? "admin-check--on" : "admin-check--off"}`}>
                  {checked ? "✓" : "✕"}
                </span>
                {property.label}
              </button>
            );
          })}
        </div>
      </section>

      {dynamicFields.length ? (
        <section className="admin-detail__section">
          <div className="admin-detail__section-title">Custom Fields</div>
          <div className="admin-field-grid">
            {dynamicFields.map((field) => (
              <div key={field.key} className="admin-field">
                <label>{field.label}</label>
                {field.type === "checkbox" ? (
                  <button
                    type="button"
                    className={`admin-record-extras__check${values[field.key] ? " is-checked" : ""}`}
                    disabled={savingKey === field.key}
                    onClick={() => saveProperty(field.key, !values[field.key])}
                  >
                    <span
                      className={`admin-check ${values[field.key] ? "admin-check--on" : "admin-check--off"}`}
                    >
                      {values[field.key] ? "✓" : "✕"}
                    </span>
                    {values[field.key] ? "Checked" : "Unchecked"}
                  </button>
                ) : field.type === "select" ? (
                  <select
                    value={dynamicValue(field)}
                    disabled={savingKey === field.key}
                    onChange={(event) => saveProperty(field.key, event.target.value)}
                  >
                    <option value="">—</option>
                    {(field.options || []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type === "date" ? "date" : "text"}
                    value={dynamicValue(field)}
                    disabled={savingKey === field.key}
                    placeholder={field.type === "multiselect" ? "Comma-separated values" : ""}
                    onChange={(event) =>
                      setDrafts((previous) => ({ ...previous, [field.key]: event.target.value }))
                    }
                    onBlur={(event) => {
                      const value =
                        field.type === "multiselect"
                          ? event.target.value.split(",").map((item) => item.trim()).filter(Boolean)
                          : event.target.value;

                      saveProperty(field.key, value);
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
