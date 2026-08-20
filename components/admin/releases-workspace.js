"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ADMIN_VIEWS } from "@/lib/admin-views";
import { VIEW_LAYOUTS } from "@/lib/admin-properties";
import ReleasesTable from "@/components/admin/releases-table";
import SavedView from "@/components/admin/saved-view";
import AddFieldDialog from "@/components/admin/add-field-dialog";
import { PropertiesProvider, useProperties } from "@/components/admin/properties-context";

const BUILTIN_ENTRIES = Object.entries(ADMIN_VIEWS).filter(([, definition]) => !definition.hidden);

const LAYOUT_ICONS = {
  table: "▦",
  timeline: "―",
  chart: "▙",
  calendar: "▤",
  dashboard: "◫"
};

// The admin release-schedule workspace: system views plus user-defined saved
// views (Notion-style). Saved views are presentation only — creating, editing,
// duplicating, reordering, or deleting them never touches release records.
export default function ReleasesWorkspace(props) {
  return (
    <PropertiesProvider>
      <WorkspaceInner {...props} />
    </PropertiesProvider>
  );
}

function WorkspaceInner({ initialViews, initialActive }) {
  const router = useRouter();
  const [views, setViews] = useState(initialViews);
  const [active, setActive] = useState(initialActive);
  const [isCreating, setIsCreating] = useState(false);
  const [isAddingField, setIsAddingField] = useState(false);
  const { refresh: refreshProperties } = useProperties();
  const [createName, setCreateName] = useState("");
  const [createLayout, setCreateLayout] = useState("table");
  const [menuFor, setMenuFor] = useState(null);
  const [error, setError] = useState("");
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuFor(null);
      }
    }

    document.addEventListener("mousedown", handleClick);

    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function activate(key) {
    setActive(key);
    setMenuFor(null);
    router.replace(`/admin/releases?view=${encodeURIComponent(key)}`, { scroll: false });
  }

  async function refreshViews() {
    const response = await fetch("/api/admin/views");
    const body = await response.json();

    if (response.ok) {
      setViews(body.views || []);
    }

    return body.views || [];
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError("");

    try {
      const response = await fetch("/api/admin/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName, layout: createLayout })
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error || "Could not create the view.");
      }

      await refreshViews();
      setIsCreating(false);
      setCreateName("");
      activate(`saved:${body.view.id}`);
    } catch (createError) {
      setError(createError.message);
    }
  }

  async function handleRename(view) {
    const name = window.prompt("Rename view", view.name);

    if (!name || !name.trim() || name.trim() === view.name) {
      setMenuFor(null);
      return;
    }

    await fetch(`/api/admin/views/${view.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() })
    });
    await refreshViews();
    setMenuFor(null);
  }

  async function handleDuplicate(view) {
    const response = await fetch("/api/admin/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `${view.name} (copy)`, duplicateOf: view.id })
    });
    const body = await response.json();

    await refreshViews();
    setMenuFor(null);

    if (response.ok && body?.view?.id) {
      activate(`saved:${body.view.id}`);
    }
  }

  async function handleDelete(view) {
    if (!window.confirm(`Delete the view "${view.name}"? Records are never deleted.`)) {
      setMenuFor(null);
      return;
    }

    await fetch(`/api/admin/views/${view.id}`, { method: "DELETE" });
    const remaining = await refreshViews();
    setMenuFor(null);

    if (active === `saved:${view.id}`) {
      activate(remaining.length ? `saved:${remaining[0].id}` : "upcoming");
    }
  }

  async function handleMove(view, direction) {
    const index = views.findIndex((candidate) => candidate.id === view.id);
    const target = index + direction;

    if (target < 0 || target >= views.length) {
      return;
    }

    const reordered = [...views];

    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setViews(reordered);

    await fetch("/api/admin/views/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map((candidate) => candidate.id) })
    });
  }

  const activeSaved = active.startsWith("saved:")
    ? views.find((view) => `saved:${view.id}` === active)
    : null;

  return (
    <div>
      <div className="admin-view-tabs">
        {BUILTIN_ENTRIES.map(([key, definition]) => (
          <button
            key={key}
            type="button"
            className={`admin-view-tab${key === active ? " is-active" : ""}`}
            onClick={() => activate(key)}
          >
            {definition.label}
          </button>
        ))}

        {views.map((view) => {
          const key = `saved:${view.id}`;

          return (
            <span key={key} className="admin-view-tab-wrap" ref={menuFor === view.id ? menuRef : null}>
              <button
                type="button"
                className={`admin-view-tab admin-view-tab--saved${key === active ? " is-active" : ""}`}
                onClick={() => activate(key)}
              >
                <span className="admin-view-tab__icon">{LAYOUT_ICONS[view.layout] || "▦"}</span>
                {view.name}
                <span
                  className="admin-view-tab__menu"
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    setMenuFor(menuFor === view.id ? null : view.id);
                  }}
                >
                  ⋯
                </span>
              </button>
              {menuFor === view.id ? (
                <span className="admin-view-menu">
                  <button type="button" onClick={() => handleRename(view)}>
                    Rename
                  </button>
                  <button type="button" onClick={() => handleDuplicate(view)}>
                    Duplicate
                  </button>
                  <button type="button" onClick={() => handleMove(view, -1)}>
                    Move left
                  </button>
                  <button type="button" onClick={() => handleMove(view, 1)}>
                    Move right
                  </button>
                  <button
                    type="button"
                    className="admin-view-menu__danger"
                    onClick={() => handleDelete(view)}
                  >
                    Delete
                  </button>
                </span>
              ) : null}
            </span>
          );
        })}

        <button
          type="button"
          className="admin-view-tab admin-view-tab--new"
          onClick={() => setIsCreating(true)}
        >
          + New View
        </button>
        <button
          type="button"
          className="admin-view-tab admin-view-tab--new"
          onClick={() => setIsAddingField(true)}
        >
          + Add Field
        </button>
      </div>

      {isAddingField ? (
        <AddFieldDialog
          onClose={() => setIsAddingField(false)}
          onCreated={() => refreshProperties()}
        />
      ) : null}

      {isCreating ? (
        <form className="admin-create-view" onSubmit={handleCreate}>
          <input
            autoFocus
            className="admin-search"
            placeholder="View name"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
          />
          <div className="admin-create-view__layouts">
            {VIEW_LAYOUTS.map((layout) => (
              <button
                key={layout.key}
                type="button"
                className={`admin-view-tab${createLayout === layout.key ? " is-active" : ""}`}
                onClick={() => setCreateLayout(layout.key)}
              >
                {LAYOUT_ICONS[layout.key]} {layout.label}
              </button>
            ))}
          </div>
          <div className="admin-create-view__actions">
            <button type="submit" className="admin-primary-button" disabled={!createName.trim()}>
              Create view
            </button>
            <button
              type="button"
              className="admin-ghost-button"
              onClick={() => {
                setIsCreating(false);
                setError("");
              }}
            >
              Cancel
            </button>
          </div>
          {error ? <div className="admin-banner admin-banner--error">{error}</div> : null}
        </form>
      ) : null}

      {activeSaved ? (
        <SavedView
          key={activeSaved.id}
          view={activeSaved}
          allViews={views}
          onViewUpdated={refreshViews}
        />
      ) : (
        <ReleasesTable viewKey={ADMIN_VIEWS[active] ? active : "upcoming"} />
      )}
    </div>
  );
}
