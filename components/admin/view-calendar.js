"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { releaseHref } from "@/components/admin/cell-value";
import { useViewRows } from "@/components/admin/use-view-rows";
import { getViewProperty } from "@/lib/admin-properties";
import { buildFormValuesFromUnifiedRow } from "@/lib/admin-form-config";
import { deriveKindFromRow } from "@/lib/unified-mapping";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DRAGGABLE_DATES = {
  release_date: "releaseDate",
  pre_order_date: "preorderDate",
  recording_date: "recordingDate",
  socials_release_date: "socialReleaseDate",
  creation_date: "creationDate",
  premiere_page_release_date: "premiereDate"
};

function currentMonthKey() {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(monthKey, offset) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);

  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });
}

function cardValue(row, key) {
  const value = row[key];

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (value && typeof value === "object") {
    return value.start || value.date?.start || value.string || "";
  }

  if (typeof value === "boolean") {
    return value ? "✓" : "";
  }

  return value || "";
}

export default function ViewCalendar({ config, mini = false }) {
  const [month, setMonth] = useState(currentMonthKey());
  const [dragError, setDragError] = useState("");
  const dateKey = config.dateProperty || "release_date";
  const property = getViewProperty(dateKey);
  const { rows, isLoading, error, reload } = useViewRows(config, {
    pageSize: 500,
    month,
    monthProperty: dateKey
  });

  const cardProperties = (config.cardProperties || []).filter((key) => key !== "release_title");

  const releasesByDay = useMemo(() => {
    const map = new Map();

    for (const row of rows) {
      const value = row[dateKey];
      const day = String(value?.start || value?.date?.start || "").slice(0, 10);

      if (!day) {
        continue;
      }

      if (!map.has(day)) {
        map.set(day, []);
      }

      map.get(day).push(row);
    }

    return map;
  }, [rows, dateKey]);

  const cells = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    const leadingBlanks = new Date(year, monthNumber - 1, 1).getDay();
    const daysInMonth = new Date(year, monthNumber, 0).getDate();
    const dayCells = [];

    for (let i = 0; i < leadingBlanks; i += 1) {
      dayCells.push(null);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      dayCells.push(`${month}-${String(day).padStart(2, "0")}`);
    }

    while (dayCells.length % 7 !== 0) {
      dayCells.push(null);
    }

    return dayCells;
  }, [month]);

  async function moveRecord(rowId, day) {
    const row = rows.find((candidate) => candidate.unified_record_id === rowId);
    const payloadKey = DRAGGABLE_DATES[dateKey];

    if (!row || !payloadKey) {
      return;
    }

    const kind = deriveKindFromRow(row);
    const payload = buildFormValuesFromUnifiedRow(row, kind);

    if (!(payloadKey in payload)) {
      setDragError("This date property isn't editable for that submission type.");
      return;
    }

    payload[payloadKey] = day;

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

  if (!property) {
    return (
      <div className="admin-empty">
        This view has no valid date property. Choose one in View settings.
      </div>
    );
  }

  const today = (() => {
    const now = new Date();

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
  })();

  return (
    <div className={mini ? "admin-calendar-view admin-calendar-view--mini" : "admin-calendar-view"}>
      {error ? <div className="admin-banner admin-banner--error">{error}</div> : null}
      {dragError ? <div className="admin-banner admin-banner--error">{dragError}</div> : null}

      <div className="admin-calendar">
        <div className="admin-calendar__header">
          <div className="admin-calendar__month">{monthLabel(month)}</div>
          <div className="admin-calendar__nav">
            <button type="button" onClick={() => setMonth(shiftMonth(month, -1))}>
              ← Prev
            </button>
            <button type="button" onClick={() => setMonth(currentMonthKey())}>
              Today
            </button>
            <button type="button" onClick={() => setMonth(shiftMonth(month, 1))}>
              Next →
            </button>
          </div>
        </div>

        <div className="admin-calendar__weekdays">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday}>{weekday}</div>
          ))}
        </div>

        <div className="admin-calendar__grid">
          {cells.map((dayKey, index) => {
            if (!dayKey) {
              return (
                <div
                  key={`blank-${index}`}
                  className="admin-calendar__day admin-calendar__day--outside"
                />
              );
            }

            const dayReleases = releasesByDay.get(dayKey) || [];

            return (
              <div
                key={dayKey}
                className={`admin-calendar__day${dayKey === today ? " admin-calendar__day--today" : ""}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const rowId = event.dataTransfer.getData("text/rowid");

                  if (rowId) {
                    moveRecord(rowId, dayKey);
                  }
                }}
              >
                <span className="admin-calendar__daytop">
                  <span className="admin-calendar__date">{Number(dayKey.slice(-2))}</span>
                  {!mini ? (
                    <Link
                      href={`/admin/releases/new?date=${dayKey}`}
                      className="admin-calendar__add"
                      title="Create a record on this date"
                    >
                      +
                    </Link>
                  ) : null}
                </span>
                {dayReleases.map((row) => (
                  <Link
                    key={row.unified_record_id}
                    href={releaseHref(row)}
                    className="admin-calendar__pill"
                    draggable={!mini && Boolean(DRAGGABLE_DATES[dateKey])}
                    onDragStart={(event) =>
                      event.dataTransfer.setData("text/rowid", row.unified_record_id)
                    }
                    title={`${row.release_title || "Untitled"} — ${row.display_artist || ""}`}
                  >
                    <span>{row.release_title || "Untitled"}</span>
                    {cardProperties.map((key) => {
                      const value = cardValue(row, key);

                      return value ? (
                        <span key={key} className="admin-calendar__pill-meta">
                          {value}
                        </span>
                      ) : null;
                    })}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {isLoading ? <div className="admin-loading">Loading calendar…</div> : null}
    </div>
  );
}
