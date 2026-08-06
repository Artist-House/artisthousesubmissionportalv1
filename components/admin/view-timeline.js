"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { releaseHref, statusBadgeClass } from "@/components/admin/cell-value";
import { useViewRows } from "@/components/admin/use-view-rows";
import { getViewProperty } from "@/lib/admin-properties";
import { buildFormValuesFromUnifiedRow } from "@/lib/admin-form-config";
import { deriveKindFromRow } from "@/lib/unified-mapping";

const PX_PER_DAY = { day: 48, week: 18, month: 5, quarter: 2, year: 0.75 };

// Date properties that can be updated by dragging a bar, mapped to the admin
// payload key that carries them.
const DRAGGABLE_DATES = {
  release_date: "releaseDate",
  pre_order_date: "preorderDate",
  recording_date: "recordingDate",
  socials_release_date: "socialReleaseDate",
  creation_date: "creationDate",
  premiere_page_release_date: "premiereDate"
};

function dateStart(row, key) {
  const value = row?.[key];

  return String(value?.start || value?.date?.start || "").slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
}

function addDays(date, days) {
  const next = new Date(`${date}T00:00:00Z`);

  next.setUTCDate(next.getUTCDate() + days);

  return next.toISOString().slice(0, 10);
}

function buildTicks(rangeStart, totalDays, scale) {
  const ticks = [];
  const stepDays = { day: 1, week: 7, month: 30, quarter: 91, year: 365 }[scale] || 30;

  for (let offset = 0; offset <= totalDays; offset += stepDays) {
    const date = addDays(rangeStart, offset);
    const label =
      scale === "day" || scale === "week"
        ? date.slice(5)
        : scale === "year"
          ? date.slice(0, 4)
          : date.slice(0, 7);

    ticks.push({ offset, label });
  }

  return ticks;
}

export default function ViewTimeline({ config, updateConfig, mini = false }) {
  const { rows, isLoading, error, reload } = useViewRows(config, { pageSize: 500 });
  const [dragError, setDragError] = useState("");
  const dragRef = useRef(null);

  const dateKey = config.dateProperty || "release_date";
  const property = getViewProperty(dateKey);
  const scale = config.scale || "month";
  const pxPerDay = PX_PER_DAY[scale] || 5;
  const showTable = config.showTable !== false && !mini;

  const dated = useMemo(
    () =>
      rows
        .map((row) => ({ row, date: dateStart(row, dateKey) }))
        .filter((item) => /^\d{4}-\d{2}-\d{2}/.test(item.date)),
    [rows, dateKey]
  );

  const range = useMemo(() => {
    if (!dated.length) {
      return null;
    }

    const dates = dated.map((item) => item.date).sort();
    const start = addDays(dates[0], -7);
    const end = addDays(dates[dates.length - 1], 14);

    return { start, totalDays: Math.max(daysBetween(start, end), 30) };
  }, [dated]);

  function startDrag(event, item) {
    if (mini || !DRAGGABLE_DATES[dateKey]) {
      return;
    }

    event.preventDefault();
    setDragError("");
    dragRef.current = { item, startX: event.clientX, deltaDays: 0 };

    const bar = event.currentTarget;

    function onMove(moveEvent) {
      const deltaDays = Math.round((moveEvent.clientX - dragRef.current.startX) / pxPerDay);

      dragRef.current.deltaDays = deltaDays;
      bar.style.transform = `translateX(${deltaDays * pxPerDay}px)`;
    }

    async function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      bar.style.transform = "";

      const { deltaDays } = dragRef.current;

      dragRef.current = null;

      if (!deltaDays) {
        return;
      }

      const { row, date } = item;
      const kind = deriveKindFromRow(row);
      const payload = buildFormValuesFromUnifiedRow(row, kind);
      const payloadKey = DRAGGABLE_DATES[dateKey];

      if (!(payloadKey in payload)) {
        setDragError("This date property isn't editable for that submission type.");
        return;
      }

      payload[payloadKey] = addDays(date, deltaDays);

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
          throw new Error(body?.error || "Could not move the record.");
        }

        reload();
      } catch (moveError) {
        setDragError(moveError.message);
      }
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  if (isLoading) {
    return <div className="admin-loading">Loading timeline…</div>;
  }

  if (error) {
    return <div className="admin-banner admin-banner--error">{error}</div>;
  }

  if (!property || !dated.length) {
    return (
      <div className="admin-empty">
        No records have a value for the selected date property
        {property ? ` (${property.label})` : ""}.{" "}
        {!mini ? "Choose a different date property in View settings." : ""}
      </div>
    );
  }

  const ticks = buildTicks(range.start, range.totalDays, scale);
  const labelOffset = showTable ? 340 : 12;
  const laneWidth = labelOffset + Math.ceil(range.totalDays * pxPerDay) + 120;

  return (
    <div className={mini ? "admin-timeline admin-timeline--mini" : "admin-timeline"}>
      {dragError ? <div className="admin-banner admin-banner--error">{dragError}</div> : null}
      <div className="admin-timeline__scroll">
        <div style={{ width: laneWidth }}>
          <div className="admin-timeline__ticks">
            {ticks.map((tick) => (
              <span key={tick.offset} style={{ left: labelOffset + tick.offset * pxPerDay }}>
                {tick.label}
              </span>
            ))}
          </div>
          <div className="admin-timeline__lanes">
            {dated.map((item) => {
              const offset = daysBetween(range.start, item.date);
              const row = item.row;

              return (
                <div key={row.unified_record_id} className="admin-timeline__lane">
                  {showTable ? (
                    <span className="admin-timeline__label">
                      <Link href={releaseHref(row)} className="admin-table__link">
                        {row.release_title || "Untitled"}
                      </Link>
                      {row.status ? (
                        <span className={statusBadgeClass(row.status)}>{row.status}</span>
                      ) : null}
                    </span>
                  ) : null}
                  <span
                    className="admin-timeline__bar"
                    style={{ left: labelOffset + offset * pxPerDay, width: Math.max(pxPerDay, 10) }}
                    title={`${row.release_title || "Untitled"} — ${item.date}`}
                    onMouseDown={(event) => startDrag(event, item)}
                  >
                    {!showTable ? row.release_title || "Untitled" : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {!mini && DRAGGABLE_DATES[dateKey] ? (
        <div className="admin-count" style={{ marginTop: 8 }}>
          Drag a bar horizontally to change its {property.label}. Bars snap to days.
        </div>
      ) : null}
    </div>
  );
}
