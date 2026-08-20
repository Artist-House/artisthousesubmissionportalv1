"use client";

import { useState } from "react";

const FIELD_TYPES = [
  { key: "text", label: "Text" },
  { key: "checkbox", label: "Checkbox" },
  { key: "date", label: "Date" },
  { key: "select", label: "Select" },
  { key: "multi_select", label: "Multi-select" },
  { key: "url", label: "URL" },
  { key: "number", label: "Number" }
];

// Adds a new field to the release database: the Notion property, the Supabase
// columns (release_schedule / notion_datatable / unified), and the sync map —
// so the field exists in both systems and stays synced.
export default function AddFieldDialog({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("text");
  const [options, setOptions] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [created, setCreated] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          options: options
            .split(",")
            .map((option) => option.trim())
            .filter(Boolean)
        })
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error || "Could not add the field.");
      }

      setCreated(body.field);
      onCreated?.(body.field);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  }

  if (created) {
    return (
      <div className="admin-create-view">
        <div className="admin-banner admin-banner--success">
          "{created.name}" was added to the Notion release database and the Supabase mirror. It's
          now available in view settings (properties, filters, sorts) and on release pages.
        </div>
        <div className="admin-create-view__actions">
          <button type="button" className="admin-primary-button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="admin-create-view" onSubmit={handleSubmit}>
      <div className="admin-count">
        New database field — created in Notion and Supabase together. (Notion's API can't create
        Status fields; use a Select instead.)
      </div>
      <input
        autoFocus
        className="admin-search"
        placeholder="Field name (e.g. Marketing Approved)"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <div className="admin-create-view__layouts">
        {FIELD_TYPES.map((fieldType) => (
          <button
            key={fieldType.key}
            type="button"
            className={`admin-view-tab${type === fieldType.key ? " is-active" : ""}`}
            onClick={() => setType(fieldType.key)}
          >
            {fieldType.label}
          </button>
        ))}
      </div>
      {type === "select" || type === "multi_select" ? (
        <input
          className="admin-search"
          placeholder="Options, comma separated (e.g. Yes, No, Maybe)"
          value={options}
          onChange={(event) => setOptions(event.target.value)}
        />
      ) : null}
      <div className="admin-create-view__actions">
        <button type="submit" className="admin-primary-button" disabled={isSaving || !name.trim()}>
          {isSaving ? "Adding…" : "Add field"}
        </button>
        <button type="button" className="admin-ghost-button" onClick={onClose}>
          Cancel
        </button>
      </div>
      {error ? <div className="admin-banner admin-banner--error">{error}</div> : null}
    </form>
  );
}
