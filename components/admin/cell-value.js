"use client";

import Link from "next/link";

export function formatDate(value) {
  if (!value) {
    return "—";
  }

  const [year, month, day] = String(value).slice(0, 10).split("-");

  if (!year || !month || !day) {
    return String(value);
  }

  return `${month}/${day}/${year}`;
}

export function releaseHref(row) {
  return `/admin/releases/${encodeURIComponent(row.unified_record_id)}`;
}

export function statusBadgeClass(value) {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

  return `admin-badge admin-badge--status-${slug}`;
}

export default function CellValue({ column, row }) {
  const value = row[column.key];

  switch (column.render) {
    case "link":
      return (
        <Link href={releaseHref(row)} className="admin-table__link">
          {value || "Untitled release"}
        </Link>
      );
    case "date":
      return formatDate(value);
    case "notion-date":
      // Notion-style jsonb date, either { start, ... } directly or wrapped as
      // { type: "date", date: { start, ... } } (formula/rollup shape).
      return formatDate(value?.start || value?.date?.start);
    case "notion-formula":
      // Notion formula value: { type: "string", string: "..." }.
      return value?.string || "—";
    case "url":
      return value ? (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="admin-table__link admin-table__clip"
          onClick={(event) => event.stopPropagation()}
          title={value}
        >
          {value}
        </a>
      ) : (
        "—"
      );
    case "relation":
      // Notion relation: array of linked page ids — show the count.
      return Array.isArray(value) && value.length ? `${value.length} linked` : "—";
    case "badge":
      return value ? <span className={statusBadgeClass(value)}>{value}</span> : "—";
    case "tags":
      return Array.isArray(value) && value.length ? value.join(", ") : "—";
    case "check":
      return value ? (
        <span className="admin-check admin-check--on">✓</span>
      ) : (
        <span className="admin-check admin-check--off">✕</span>
      );
    default:
      return value ? (
        <span className="admin-table__clip" title={String(value)}>
          {String(value)}
        </span>
      ) : (
        "—"
      );
  }
}
