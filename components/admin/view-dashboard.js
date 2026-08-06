"use client";

import { useMemo, useState } from "react";
import CellValue from "@/components/admin/cell-value";
import { useViewRows } from "@/components/admin/use-view-rows";
import { getViewProperty, defaultConfigForLayout } from "@/lib/admin-properties";
import ViewChart from "@/components/admin/view-chart";
import ViewCalendar from "@/components/admin/view-calendar";
import ViewTimeline from "@/components/admin/view-timeline";

const HEIGHTS = { s: 260, m: 380, l: 540 };

function MiniTable({ config }) {
  const { rows, isLoading, error } = useViewRows(config, { pageSize: 8 });
  const columns = useMemo(
    () =>
      (config.visibleProperties || [])
        .slice(0, 4)
        .map((key) => getViewProperty(key))
        .filter(Boolean),
    [config.visibleProperties]
  );

  if (isLoading) {
    return <div className="admin-loading">Loading…</div>;
  }

  if (error) {
    return <div className="admin-banner admin-banner--error">{error}</div>;
  }

  return (
    <div className="admin-table-wrap admin-table-wrap--mini">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.unified_record_id}>
              {columns.map((column) => (
                <td key={column.key}>
                  <CellValue column={column} row={row} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// A dashboard is a canvas of widgets. Each widget references an existing view
// (its live configuration) — it never copies data or settings.
export default function ViewDashboard({ view, config, updateConfig, allViews }) {
  const [isAdding, setIsAdding] = useState(false);
  const widgets = Array.isArray(config.widgets) ? config.widgets : [];
  const referencableViews = allViews.filter(
    (candidate) => candidate.layout !== "dashboard" && candidate.id !== view.id
  );

  function saveWidgets(next) {
    updateConfig({ widgets: next });
  }

  function addWidget(viewId) {
    saveWidgets([
      ...widgets,
      { id: `w${Date.now()}`, viewId, width: 1, height: "m" }
    ]);
    setIsAdding(false);
  }

  function patchWidget(id, patch) {
    saveWidgets(widgets.map((widget) => (widget.id === id ? { ...widget, ...patch } : widget)));
  }

  function moveWidget(id, direction) {
    const index = widgets.findIndex((widget) => widget.id === id);
    const target = index + direction;

    if (index < 0 || target < 0 || target >= widgets.length) {
      return;
    }

    const next = [...widgets];

    [next[index], next[target]] = [next[target], next[index]];
    saveWidgets(next);
  }

  return (
    <div>
      <div className="admin-toolbar">
        <span className="admin-count">
          {widgets.length} widget{widgets.length === 1 ? "" : "s"} — each references a saved view
        </span>
        <button type="button" className="admin-ghost-button" onClick={() => setIsAdding(!isAdding)}>
          + Add widget
        </button>
      </div>

      {isAdding ? (
        <div className="admin-create-view">
          {referencableViews.length ? (
            <div className="admin-create-view__layouts">
              {referencableViews.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className="admin-view-tab"
                  onClick={() => addWidget(candidate.id)}
                >
                  {candidate.name} ({candidate.layout})
                </button>
              ))}
            </div>
          ) : (
            <div className="admin-empty">
              Create a Table, Timeline, Chart, or Calendar view first — dashboard widgets
              reference existing views.
            </div>
          )}
        </div>
      ) : null}

      {!widgets.length && !isAdding ? (
        <div className="admin-empty">This dashboard is empty. Add a widget to get started.</div>
      ) : null}

      <div className="admin-dashboard">
        {widgets.map((widget) => {
          const referenced = allViews.find((candidate) => candidate.id === widget.viewId);

          if (!referenced) {
            return (
              <div key={widget.id} className="admin-widget" style={{ gridColumn: "span 1" }}>
                <div className="admin-widget__bar">
                  <span>Missing view</span>
                  <span className="admin-widget__controls">
                    <button type="button" onClick={() => saveWidgets(widgets.filter((candidate) => candidate.id !== widget.id))}>
                      ✕
                    </button>
                  </span>
                </div>
                <div className="admin-empty">The referenced view was deleted.</div>
              </div>
            );
          }

          const referencedConfig = {
            ...defaultConfigForLayout(referenced.layout),
            ...(referenced.config || {})
          };

          return (
            <div
              key={widget.id}
              className="admin-widget"
              style={{
                gridColumn: `span ${widget.width === 2 ? 2 : 1}`,
                minHeight: HEIGHTS[widget.height] || HEIGHTS.m
              }}
            >
              <div className="admin-widget__bar">
                <span>
                  {referenced.name} · {referenced.layout}
                </span>
                <span className="admin-widget__controls">
                  <button type="button" title="Move left" onClick={() => moveWidget(widget.id, -1)}>
                    ←
                  </button>
                  <button type="button" title="Move right" onClick={() => moveWidget(widget.id, 1)}>
                    →
                  </button>
                  <button
                    type="button"
                    title="Toggle width"
                    onClick={() => patchWidget(widget.id, { width: widget.width === 2 ? 1 : 2 })}
                  >
                    ⇔
                  </button>
                  <button
                    type="button"
                    title="Cycle height"
                    onClick={() =>
                      patchWidget(widget.id, {
                        height: widget.height === "s" ? "m" : widget.height === "m" ? "l" : "s"
                      })
                    }
                  >
                    ⇕
                  </button>
                  <button
                    type="button"
                    title="Remove widget"
                    onClick={() =>
                      saveWidgets(widgets.filter((candidate) => candidate.id !== widget.id))
                    }
                  >
                    ✕
                  </button>
                </span>
              </div>
              <div className="admin-widget__body">
                {referenced.layout === "table" ? <MiniTable config={referencedConfig} /> : null}
                {referenced.layout === "chart" ? (
                  <ViewChart config={referencedConfig} mini />
                ) : null}
                {referenced.layout === "calendar" ? (
                  <ViewCalendar config={referencedConfig} mini />
                ) : null}
                {referenced.layout === "timeline" ? (
                  <ViewTimeline config={referencedConfig} mini />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
