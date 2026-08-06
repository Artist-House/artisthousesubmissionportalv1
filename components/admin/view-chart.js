"use client";

import { useMemo } from "react";
import { useViewRows } from "@/components/admin/use-view-rows";
import { getViewProperty } from "@/lib/admin-properties";

const PALETTE = [
  "#f0523d",
  "#0e0e0e",
  "#b07d0e",
  "#23548f",
  "#1d7a3c",
  "#6b3fa0",
  "#3e3e3e",
  "#c74e84",
  "#4e8c8a",
  "#8a6d3b"
];

function bucketKeys(row, property) {
  const value = row[property.key];

  if (Array.isArray(value)) {
    return value.length ? value.map(String) : ["No value"];
  }

  if (value && typeof value === "object") {
    const date = value.start || value.date?.start;

    if (date) {
      return [String(date).slice(0, 7)];
    }

    return value.string ? [value.string] : ["No value"];
  }

  if (typeof value === "boolean") {
    return [value ? "Checked" : "Unchecked"];
  }

  const text = String(value ?? "").trim();

  return [text || "No value"];
}

function aggregate(rows, property, yProperty, aggregation) {
  const buckets = new Map();

  for (const row of rows) {
    for (const key of bucketKeys(row, property)) {
      if (!buckets.has(key)) {
        buckets.set(key, []);
      }

      buckets.get(key).push(row);
    }
  }

  const isDate = ["date", "formula-date", "timestamp"].includes(property.type);
  const entries = [...buckets.entries()].map(([label, bucketRows]) => {
    let value = bucketRows.length;

    if (aggregation !== "count" && yProperty) {
      const numbers = bucketRows
        .map((row) => Number(row[yProperty.key]))
        .filter((number) => Number.isFinite(number));

      if (aggregation === "sum") {
        value = numbers.reduce((sum, number) => sum + number, 0);
      } else if (aggregation === "avg") {
        value = numbers.length
          ? numbers.reduce((sum, number) => sum + number, 0) / numbers.length
          : 0;
      } else if (aggregation === "min") {
        value = numbers.length ? Math.min(...numbers) : 0;
      } else if (aggregation === "max") {
        value = numbers.length ? Math.max(...numbers) : 0;
      }
    }

    return { label, value };
  });

  entries.sort((a, b) => (isDate ? a.label.localeCompare(b.label) : b.value - a.value));

  if (entries.length > 20) {
    const kept = entries.slice(0, 19);
    const rest = entries.slice(19).reduce((sum, entry) => sum + entry.value, 0);

    kept.push({ label: "Other", value: rest });

    return kept;
  }

  return entries;
}

function BarChart({ data, height }) {
  const width = Math.max(360, data.length * 56);
  const max = Math.max(...data.map((entry) => entry.value), 1);
  const chartHeight = height - 60;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="admin-chart__svg" style={{ minWidth: width }}>
      {data.map((entry, index) => {
        const barHeight = Math.max(2, (entry.value / max) * chartHeight);
        const x = index * 56 + 12;

        return (
          <g key={entry.label}>
            <rect
              x={x}
              y={chartHeight - barHeight + 10}
              width={36}
              height={barHeight}
              rx={4}
              fill={PALETTE[0]}
            />
            <text x={x + 18} y={chartHeight - barHeight + 2} textAnchor="middle" className="admin-chart__value">
              {Math.round(entry.value * 100) / 100}
            </text>
            <text
              x={x + 18}
              y={chartHeight + 26}
              textAnchor="end"
              transform={`rotate(-35 ${x + 18} ${chartHeight + 26})`}
              className="admin-chart__label"
            >
              {entry.label.length > 14 ? `${entry.label.slice(0, 13)}…` : entry.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ data, height }) {
  const width = Math.max(360, data.length * 48);
  const max = Math.max(...data.map((entry) => entry.value), 1);
  const chartHeight = height - 60;
  const points = data.map((entry, index) => {
    const x = index * 48 + 24;
    const y = chartHeight - (entry.value / max) * (chartHeight - 20) + 10;

    return { ...entry, x, y };
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="admin-chart__svg" style={{ minWidth: width }}>
      <polyline
        fill="none"
        stroke={PALETTE[0]}
        strokeWidth={2.5}
        points={points.map((point) => `${point.x},${point.y}`).join(" ")}
      />
      {points.map((point) => (
        <g key={point.label}>
          <circle cx={point.x} cy={point.y} r={4} fill={PALETTE[0]} />
          <text x={point.x} y={point.y - 10} textAnchor="middle" className="admin-chart__value">
            {Math.round(point.value * 100) / 100}
          </text>
          <text
            x={point.x}
            y={chartHeight + 26}
            textAnchor="end"
            transform={`rotate(-35 ${point.x} ${chartHeight + 26})`}
            className="admin-chart__label"
          >
            {point.label.length > 14 ? `${point.label.slice(0, 13)}…` : point.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function PieChart({ data, height }) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0) || 1;
  const cx = height / 2;
  const cy = height / 2;
  const radius = height / 2 - 10;
  let angle = -Math.PI / 2;

  const slices = data.map((entry, index) => {
    const share = entry.value / total;
    const startAngle = angle;
    const endAngle = angle + share * Math.PI * 2;

    angle = endAngle;

    const largeArc = share > 0.5 ? 1 : 0;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);

    return {
      ...entry,
      color: PALETTE[index % PALETTE.length],
      path:
        share >= 0.999
          ? `M ${cx - radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx + radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx - radius} ${cy}`
          : `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`,
      share
    };
  });

  return (
    <div className="admin-chart__pie">
      <svg viewBox={`0 0 ${height} ${height}`} className="admin-chart__svg" style={{ maxWidth: height }}>
        {slices.map((slice) => (
          <path key={slice.label} d={slice.path} fill={slice.color} stroke="#fff" strokeWidth={1} />
        ))}
      </svg>
      <div className="admin-chart__legend">
        {slices.map((slice) => (
          <div key={slice.label}>
            <span className="admin-chart__swatch" style={{ background: slice.color }} />
            {slice.label} · {Math.round(slice.value * 100) / 100} ({Math.round(slice.share * 100)}%)
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ViewChart({ config, mini = false }) {
  const { rows, isLoading, error } = useViewRows(config, { pageSize: 500 });
  const property = getViewProperty(config.xProperty || "status");
  const yProperty = config.yProperty ? getViewProperty(config.yProperty) : null;
  const aggregation = config.aggregation || "count";

  const data = useMemo(
    () => (property ? aggregate(rows, property, yProperty, aggregation) : []),
    [rows, property, yProperty, aggregation]
  );

  if (isLoading) {
    return <div className="admin-loading">Loading chart…</div>;
  }

  if (error) {
    return <div className="admin-banner admin-banner--error">{error}</div>;
  }

  if (!property || !data.length) {
    return <div className="admin-empty">No data for this chart. Adjust the X axis or filters.</div>;
  }

  const height = mini ? 220 : 340;
  const chartType = config.chartType || "bar";

  return (
    <div className="admin-chart">
      {!mini ? (
        <div className="admin-count" style={{ marginBottom: 8 }}>
          {aggregation === "count" ? "Count" : `${aggregation}(${yProperty?.label || "—"})`} by{" "}
          {property.label} · {rows.length} records
        </div>
      ) : null}
      <div className="admin-chart__scroll">
        {chartType === "bar" ? <BarChart data={data} height={height} /> : null}
        {chartType === "line" ? <LineChart data={data} height={height} /> : null}
        {chartType === "pie" ? <PieChart data={data} height={height} /> : null}
      </div>
    </div>
  );
}
