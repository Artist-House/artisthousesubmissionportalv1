"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ADMIN_VIEWS } from "@/lib/admin-views";
import CellValue, { releaseHref } from "@/components/admin/cell-value";

// Renderer for the built-in (system) views. Tab switching lives in
// releases-workspace.js; this component only loads and displays one view.
export default function ReleasesTable({ viewKey, initialQuery = "" }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const debounceRef = useRef(null);
  const requestRef = useRef(0);

  const load = useCallback(
    async (nextQuery, nextPage) => {
      const requestId = ++requestRef.current;

      setIsLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({ view: viewKey, page: String(nextPage) });

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
    },
    [viewKey]
  );

  useEffect(() => {
    setPage(1);
    load(query, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey]);

  function handleQueryChange(value) {
    setQuery(value);
    setPage(1);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      load(value, 1);
    }, 300);
  }

  function handlePageChange(nextPage) {
    setPage(nextPage);
    load(query, nextPage);
  }

  const columns = data?.view?.columns || ADMIN_VIEWS[viewKey]?.columns || [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
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
                <tr key={row.unified_record_id} onClick={() => router.push(releaseHref(row))}>
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
          <button type="button" disabled={page <= 1} onClick={() => handlePageChange(page - 1)}>
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
