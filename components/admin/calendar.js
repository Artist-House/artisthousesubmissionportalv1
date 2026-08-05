"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

function todayKey() {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

export default function AdminCalendar({ initialMonth }) {
  const router = useRouter();
  const [month, setMonth] = useState(
    /^\d{4}-\d{2}$/.test(initialMonth) ? initialMonth : currentMonthKey()
  );
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({ view: "calendar", month });
        const response = await fetch(`/api/admin/releases?${params.toString()}`);
        const body = await response.json();

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          throw new Error(body?.error || "Could not load the calendar.");
        }

        setRows(body.rows || []);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message);
          setRows([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [month]);

  const releasesByDay = useMemo(() => {
    const map = new Map();

    for (const row of rows) {
      const day = String(row.release_date?.start || "").slice(0, 10);

      if (!day) {
        continue;
      }

      if (!map.has(day)) {
        map.set(day, []);
      }

      map.get(day).push(row);
    }

    return map;
  }, [rows]);

  const cells = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    const firstDay = new Date(year, monthNumber - 1, 1);
    const daysInMonth = new Date(year, monthNumber, 0).getDate();
    const leadingBlanks = firstDay.getDay();
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

  function handleMonthChange(nextMonth) {
    setMonth(nextMonth);
    router.replace(`/admin/calendar?month=${nextMonth}`, { scroll: false });
  }

  const today = todayKey();

  return (
    <div>
      {error ? <div className="admin-banner admin-banner--error">{error}</div> : null}

      <div className="admin-calendar">
        <div className="admin-calendar__header">
          <div className="admin-calendar__month">{monthLabel(month)}</div>
          <div className="admin-calendar__nav">
            <button type="button" onClick={() => handleMonthChange(shiftMonth(month, -1))}>
              ← Prev
            </button>
            <button type="button" onClick={() => handleMonthChange(currentMonthKey())}>
              Today
            </button>
            <button type="button" onClick={() => handleMonthChange(shiftMonth(month, 1))}>
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
              return <div key={`blank-${index}`} className="admin-calendar__day admin-calendar__day--outside" />;
            }

            const dayReleases = releasesByDay.get(dayKey) || [];
            const isToday = dayKey === today;

            return (
              <div
                key={dayKey}
                className={`admin-calendar__day${isToday ? " admin-calendar__day--today" : ""}`}
              >
                <span className="admin-calendar__date">{Number(dayKey.slice(-2))}</span>
                {dayReleases.map((row) => (
                  <Link
                    key={row.unified_record_id}
                    href={`/admin/releases/${encodeURIComponent(row.unified_record_id)}`}
                    className="admin-calendar__pill"
                    title={`${row.release_title || "Untitled"} — ${row.display_artist || ""}`}
                  >
                    {row.release_title || "Untitled"}
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
