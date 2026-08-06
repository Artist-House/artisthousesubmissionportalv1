"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import CellValue, { releaseHref } from "@/components/admin/cell-value";
import { useViewRows } from "@/components/admin/use-view-rows";
import { getViewProperty, INLINE_EDITABLE } from "@/lib/admin-properties";
import { buildFormValuesFromUnifiedRow } from "@/lib/admin-form-config";
import { deriveKindFromRow } from "@/lib/unified-mapping";

function groupLabel(row, property) {
  const value = row[property.key];

  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "No value";
  }

  if (typeof value === "boolean") {
    return value ? property.label : `No ${property.label}`;
  }

  return String(value || "").trim() || "No value";
}

export default function ViewTable({ config, updateConfig }) {
  const [page, setPage] = useState(1);
  const grouped = Boolean(config.groupBy);
  const { rows, total, isLoading, error, reload } = useViewRows(config, {
    page: grouped ? 1 : page,
    pageSize: grouped ? 500 : 50
  });
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [editError, setEditError] = useState("");
  const resizeRef = useRef(null);

  const columns = useMemo(
    () =>
      (config.visibleProperties || [])
        .map((key) => getViewProperty(key))
        .filter(Boolean),
    [config.visibleProperties]
  );

  const groups = useMemo(() => {
    if (!grouped) {
      return [{ label: null, rows }];
    }

    const property = getViewProperty(config.groupBy);

    if (!property) {
      return [{ label: null, rows }];
    }

    const map = new Map();

    for (const row of rows) {
      const label = groupLabel(row, property);

      if (!map.has(label)) {
        map.set(label, []);
      }

      map.get(label).push(row);
    }

    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, groupRows]) => ({ label, rows: groupRows }));
  }, [rows, grouped, config.groupBy]);

  function columnWidth(key) {
    return config.columnWidths?.[key];
  }

  function startResize(event, key) {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = event.currentTarget.parentElement.offsetWidth;

    function onMove(moveEvent) {
      const width = Math.max(80, startWidth + (moveEvent.clientX - startX));

      resizeRef.current = { key, width };
      moveEvent.preventDefault();

      const th = document.querySelector(`th[data-column="${key}"]`);

      if (th) {
        th.style.width = `${width}px`;
        th.style.minWidth = `${width}px`;
      }
    }

    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);

      if (resizeRef.current?.key === key) {
        updateConfig({
          columnWidths: { ...(config.columnWidths || {}), [key]: resizeRef.current.width }
        });
        resizeRef.current = null;
      }
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function beginEdit(row, column) {
    const editable = INLINE_EDITABLE[column.key];

    if (!editable) {
      return;
    }

    const formValues = buildFormValuesFromUnifiedRow(row, deriveKindFromRow(row));

    setEditError("");
    setEditing({ rowId: row.unified_record_id, column: column.key });
    setEditValue(formValues[editable.payloadKey] || "");
  }

  async function commitEdit(row, column) {
    const editable = INLINE_EDITABLE[column.key];
    const kind = deriveKindFromRow(row);
    const payload = buildFormValuesFromUnifiedRow(row, kind);

    payload[editable.payloadKey] = editValue;
    setEditing(null);

    try {
      const response = await fetch(
        `/api/admin/releases/${encodeURIComponent(row.unified_record_id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload })
        }
      );
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error || "Could not save the change.");
      }

      reload();
    } catch (saveError) {
      setEditError(saveError.message);
    }
  }

  function renderEditor(row, column) {
    const editable = INLINE_EDITABLE[column.key];

    if (editable.input === "select") {
      return (
        <select
          autoFocus
          value={editValue}
          onChange={(event) => setEditValue(event.target.value)}
          onBlur={() => commitEdit(row, column)}
          onClick={(event) => event.stopPropagation()}
        >
          <option value="">—</option>
          {editable.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        autoFocus
        type={editable.input === "date" ? "date" : "text"}
        value={editValue}
        onChange={(event) => setEditValue(event.target.value)}
        onBlur={() => commitEdit(row, column)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commitEdit(row, column);
          }

          if (event.key === "Escape") {
            setEditing(null);
          }
        }}
        onClick={(event) => event.stopPropagation()}
      />
    );
  }

  const totalPages = grouped ? 1 : Math.max(1, Math.ceil(total / 50));

  return (
    <div>
      <div className="admin-toolbar">
        <span className="admin-count">{total} releases</span>
        <Link href="/admin/releases/new" className="admin-ghost-button">
          + New record
        </Link>
      </div>

      {error ? <div className="admin-banner admin-banner--error">{error}</div> : null}
      {editError ? <div className="admin-banner admin-banner--error">{editError}</div> : null}

      <div className="admin-table-wrap">
        {isLoading ? (
          <div className="admin-loading">Loading records…</div>
        ) : rows.length === 0 ? (
          <div className="admin-empty">No records match this view.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    data-column={column.key}
                    style={
                      columnWidth(column.key)
                        ? { width: columnWidth(column.key), minWidth: columnWidth(column.key) }
                        : undefined
                    }
                  >
                    {column.label}
                    <span
                      className="admin-th-resize"
                      onMouseDown={(event) => startResize(event, column.key)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.label ?? "__all__"}>
                {group.label !== null ? (
                  <tr className="admin-table__group">
                    <td colSpan={columns.length}>
                      {group.label} · {group.rows.length}
                    </td>
                  </tr>
                ) : null}
                {group.rows.map((row) => (
                  <tr key={row.unified_record_id}>
                    {columns.map((column) => {
                      const isEditing =
                        editing &&
                        editing.rowId === row.unified_record_id &&
                        editing.column === column.key;
                      const editable = Boolean(INLINE_EDITABLE[column.key]);

                      return (
                        <td
                          key={column.key}
                          className={editable ? "admin-table__editable" : undefined}
                          onDoubleClick={() => beginEdit(row, column)}
                          title={editable ? "Double-click to edit" : undefined}
                        >
                          {isEditing ? renderEditor(row, column) : <CellValue column={column} row={row} />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        )}
      </div>

      {!grouped && totalPages > 1 ? (
        <div className="admin-pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ← Prev
          </button>
          <span className="admin-count">
            Page {page} of {totalPages}
          </span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next →
          </button>
        </div>
      ) : null}
    </div>
  );
}
