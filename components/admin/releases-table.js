"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ADMIN_VIEWS } from "@/lib/admin-views";

function formatDate(value) {
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

function statusBadgeClass(value) {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

  return `admin-badge admin-badge--status-${slug}`;
}

function CellValue({ column, row }) {
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
      return Array.isArray(value) && value.length
        ? `${value.length} linked`
        : "—";
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

export default function ReleasesTable({ initialView, initialQuery, initialPage }) {
  const router = useRouter();
  const [view, setView] = useState(initialView);
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(initialPage);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const debounceRef = useRef(null);
  const requestRef = useRef(0);

  const load = useCallback(async (nextView, nextQuery, nextPage) => {
    const requestId = ++requestRef.current;

    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ view: nextView, page: String(nextPage) });

      if (nextQuery) {
        params.set("q", nextQuery);
      }

      const response = await fetch(`/api/admin/releases?${params.toString()}`);
      const body = await response.json();

      if (requestId !== requestRef.current) {
        return;
      }

      if (!response.ok) {
        throw new Error(body?.error || "Could not load releases.");
      }

      setData(body);
    } catch (loadError) {
      if (requestId === requestRef.current) {
        setError(loadError.message);
        setData(null);
      }
    } finally {
      if (requestId === requestRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load(view, query, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncUrl(nextView, nextQuery, nextPage) {
    const params = new URLSearchParams({ view: nextView });

    if (nextQuery) {
      params.set("q", nextQuery);
    }

    if (nextPage > 1) {
      params.set("page", String(nextPage));
    }

    router.replace(`/admin/releases?${params.toString()}`, { scroll: false });
  }

  function handleViewChange(nextView) {
    setView(nextView);
    setPage(1);
    syncUrl(nextView, query, 1);
    load(nextView, query, 1);
  }

  function handleQueryChange(value) {
    setQuery(value);
    setPage(1);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      syncUrl(view, value, 1);
      load(view, value, 1);
    }, 300);
  }

  function handlePageChange(nextPage) {
    setPage(nextPage);
    syncUrl(view, query, nextPage);
    load(view, query, nextPage);
  }

  const columns = data?.view?.columns || ADMIN_VIEWS[view]?.columns || [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <div className="admin-view-tabs">
        {Object.entries(ADMIN_VIEWS)
          .filter(([, definition]) => !definition.hidden)
          .map(([key, definition]) => (
          <button
            key={key}
            type="button"
            className={`admin-view-tab${key === view ? " is-active" : ""}`}
            onClick={() => handleViewChange(key)}
          >
            {definition.label}
          </button>
        ))}
      </div>

      <div className="admin-toolbar">
        <input
          type="search"
          className="admin-search"
          placeholder="Search title, artist, or label…"
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
        />
        {data ? <span className="admin-count">{data.total} releases</span> : null}
      </div>

      {error ? <div className="admin-banner admin-banner--error">{error}</div> : null}

      <div className="admin-table-wrap">
        {isLoading ? (
          <div className="admin-loading">Loading releases…</div>
        ) : !data || data.rows.length === 0 ? (
          <div className="admin-empty">No releases match this view.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr
                  key={row.unified_record_id}
                  onClick={() => router.push(releaseHref(row))}
                >
                  {columns.map((column) => (
                    <td key={column.key}>
                      <CellValue column={column} row={row} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && totalPages > 1 ? (
        <div className="admin-pagination">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => handlePageChange(page - 1)}
          >
            ← Prev
          </button>
          <span className="admin-count">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => handlePageChange(page + 1)}
          >
            Next →
          </button>
        </div>
      ) : null}
    </div>
  );
}
