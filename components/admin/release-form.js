"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FIELDS_BY_KIND, KIND_LABELS } from "@/lib/admin-form-config";

function FieldInput({ field, value, onChange }) {
  if (field.input === "textarea") {
    return (
      <textarea
        value={value || ""}
        onChange={(event) => onChange(field.key, event.target.value)}
      />
    );
  }

  if (field.input === "select") {
    return (
      <select
        value={value || ""}
        onChange={(event) => onChange(field.key, event.target.value)}
      >
        <option value="">—</option>
        {field.options.map((option) => (
          <option key={option} value={option}>
            {field.optionLabels?.[option] || option}
          </option>
        ))}
      </select>
    );
  }

  if (field.input === "select-or-text") {
    const isKnown = !value || field.options.includes(value);

    return (
      <select
        value={isKnown ? value || "" : "__custom__"}
        onChange={(event) => onChange(field.key, event.target.value)}
      >
        <option value="">—</option>
        {field.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        {!isKnown ? <option value="__custom__">{value}</option> : null}
      </select>
    );
  }

  if (field.input === "multiselect") {
    const selected = Array.isArray(value) ? value : [];

    return (
      <div className="admin-multiselect">
        {field.options.map((option) => {
          const isSelected = selected.includes(option);

          return (
            <button
              key={option}
              type="button"
              className={`admin-multiselect__option${isSelected ? " is-selected" : ""}`}
              onClick={() =>
                onChange(
                  field.key,
                  isSelected
                    ? selected.filter((item) => item !== option)
                    : [...selected, option]
                )
              }
            >
              {option}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <input
      type={field.input === "date" ? "date" : field.input === "url" ? "url" : "text"}
      value={value || ""}
      onChange={(event) => onChange(field.key, event.target.value)}
    />
  );
}

export default function ReleaseForm({ kind, initialValues, onSubmit, backHref }) {
  const [values, setValues] = useState(initialValues);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const fields = FIELDS_BY_KIND[kind] || [];
  const sections = useMemo(() => {
    const grouped = [];

    for (const field of fields) {
      const existing = grouped.find((section) => section.title === field.section);

      if (existing) {
        existing.fields.push(field);
      } else {
        grouped.push({ title: field.section, fields: [field] });
      }
    }

    return grouped;
  }, [fields]);

  function handleChange(key, value) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");

    try {
      const result = await onSubmit(values);

      if (result?.notionSkipped) {
        setStatus("warning");
        setMessage(
          "Saved to the release database. Notion sync for this submission type is pending setup."
        );
      } else if (result?.syncWarning) {
        setStatus("warning");
        setMessage("Saved to Notion, but the release database sync failed — it will need a re-sync.");
      } else {
        setStatus("success");
        setMessage("Saved.");
      }
    } catch (submitError) {
      setStatus("error");
      setMessage(submitError.message || "Could not save the release.");
    }
  }

  return (
    <form className="admin-detail" onSubmit={handleSubmit}>
      <div className="admin-detail__header">
        <h1 className="admin-detail__title">
          {values.title || "Untitled release"}
        </h1>
        <span className="admin-detail__kind">{KIND_LABELS[kind] || kind}</span>
      </div>

      {sections.map((section) => (
        <section key={section.title} className="admin-detail__section">
          <div className="admin-detail__section-title">{section.title}</div>
          <div className="admin-field-grid">
            {section.fields.map((field) => (
              <div
                key={field.key}
                className={`admin-field${field.input === "textarea" || field.input === "multiselect" ? " admin-field--wide" : ""}`}
              >
                <label htmlFor={`admin-field-${field.key}`}>
                  {field.label}
                  {field.required ? " *" : ""}
                </label>
                <FieldInput field={field} value={values[field.key]} onChange={handleChange} />
              </div>
            ))}
          </div>
        </section>
      ))}

      {message ? (
        <div
          className={`admin-banner admin-banner--${
            status === "error" ? "error" : status === "warning" ? "warning" : "success"
          }`}
        >
          {message}
        </div>
      ) : null}

      <div className="admin-actions">
        <button type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save release"}
        </button>
        <Link href={backHref}>Back to releases</Link>
      </div>
    </form>
  );
}
