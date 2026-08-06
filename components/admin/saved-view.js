"use client";

import { useEffect, useRef, useState } from "react";
import ViewSettings from "@/components/admin/view-settings";
import ViewTable from "@/components/admin/view-table";
import ViewTimeline from "@/components/admin/view-timeline";
import ViewCalendar from "@/components/admin/view-calendar";
import ViewChart from "@/components/admin/view-chart";
import ViewDashboard from "@/components/admin/view-dashboard";
import { defaultConfigForLayout } from "@/lib/admin-properties";

// A user-defined saved view: holds the view's configuration, persists changes
// (debounced) so switching views always restores the exact saved state, and
// renders the layout. Configuration edits never touch release records.
export default function SavedView({ view, allViews, onViewUpdated }) {
  const [config, setConfig] = useState({
    ...defaultConfigForLayout(view.layout),
    ...(view.config || {})
  });
  const [showSettings, setShowSettings] = useState(false);
  const [saveState, setSaveState] = useState("saved");
  const saveTimer = useRef(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setSaveState("saving");

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/views/${view.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config })
        });

        setSaveState(response.ok ? "saved" : "error");

        if (response.ok && onViewUpdated) {
          onViewUpdated();
        }
      } catch {
        setSaveState("error");
      }
    }, 800);

    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(config)]);

  function updateConfig(patch) {
    setConfig((previous) => ({ ...previous, ...patch }));
  }

  const layoutProps = { view, config, updateConfig, allViews };

  return (
    <div>
      <div className="admin-toolbar admin-toolbar--view">
        <span className="admin-count">
          {view.name} · {view.layout}
          {saveState === "saving" ? " · saving…" : saveState === "error" ? " · save failed" : ""}
        </span>
        {view.layout !== "dashboard" ? (
          <button
            type="button"
            className="admin-ghost-button"
            onClick={() => setShowSettings((value) => !value)}
          >
            {showSettings ? "Hide settings" : "View settings"}
          </button>
        ) : null}
      </div>

      {showSettings && view.layout !== "dashboard" ? (
        <ViewSettings layout={view.layout} config={config} updateConfig={updateConfig} />
      ) : null}

      {view.layout === "table" ? <ViewTable {...layoutProps} /> : null}
      {view.layout === "timeline" ? <ViewTimeline {...layoutProps} /> : null}
      {view.layout === "calendar" ? <ViewCalendar {...layoutProps} /> : null}
      {view.layout === "chart" ? <ViewChart {...layoutProps} /> : null}
      {view.layout === "dashboard" ? <ViewDashboard {...layoutProps} /> : null}
    </div>
  );
}
