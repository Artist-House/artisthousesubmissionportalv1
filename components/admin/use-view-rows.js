"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Fetches release rows for a saved-view configuration. Views are presentation
// only — this always reads the same underlying records.
export function useViewRows(config, { page = 1, pageSize, month, monthProperty } = {}) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const requestRef = useRef(0);

  const reload = useCallback(async () => {
    const requestId = ++requestRef.current;

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/releases/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            filters: config?.filters,
            sorts: config?.sorts
          },
          page,
          pageSize,
          month,
          monthProperty
        })
      });
      const body = await response.json();

      if (requestId !== requestRef.current) {
        return;
      }

      if (!response.ok) {
        throw new Error(body?.error || "Could not load records.");
      }

      setRows(body.rows || []);
      setTotal(body.total || 0);
    } catch (loadError) {
      if (requestId === requestRef.current) {
        setError(loadError.message);
        setRows([]);
        setTotal(0);
      }
    } finally {
      if (requestId === requestRef.current) {
        setIsLoading(false);
      }
    }
  }, [JSON.stringify(config?.filters), JSON.stringify(config?.sorts), page, pageSize, month, monthProperty]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { rows, total, isLoading, error, reload };
}
