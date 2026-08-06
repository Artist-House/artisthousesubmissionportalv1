"use client";

import { useCallback, useEffect, useState } from "react";

function formatDate(value) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

// The portal access allowlist. Edits write to the Notion users DB (the source
// of truth checked at sign-in) and mirror into the Supabase users table.
export default function AllowedUsers() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editEmail, setEditEmail] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/allowlist");
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error || "Could not load the allowlist.");
      }

      setUsers(body.users || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function reportResult(body, successMessage) {
    if (body.syncWarning) {
      setNotice(`${successMessage} Notion updated; the Supabase mirror will need a re-sync.`);
    } else {
      setNotice(successMessage);
    }

    setTimeout(() => setNotice(""), 5000);
  }

  async function handleAdd(event) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/allowlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail })
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error || "Could not add the user.");
      }

      setNewEmail("");
      reportResult(body, `${body.email} can now sign in to the portal.`);
      await load();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEditSave(user) {
    setError("");
    setEditingId(null);

    if (!editEmail.trim() || editEmail.trim().toLowerCase() === user.email.toLowerCase()) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/allowlist/${user.pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: editEmail })
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error || "Could not update the user.");
      }

      reportResult(body, `${user.email} updated to ${body.email}.`);
      await load();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function handleDelete(user) {
    if (
      !window.confirm(
        `Remove ${user.email} from the allowlist? They will no longer be able to sign in to the portal.`
      )
    ) {
      return;
    }

    setError("");

    try {
      const response = await fetch(`/api/admin/allowlist/${user.pageId}`, { method: "DELETE" });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error || "Could not remove the user.");
      }

      reportResult(body, `${user.email} removed from the allowlist.`);
      await load();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  return (
    <div className="admin-detail">
      <div className="admin-detail__header">
        <h1 className="admin-detail__title">Allowed Users</h1>
        <span className="admin-detail__kind">{users.length} allowed</span>
      </div>
      <p className="admin-count" style={{ margin: "4px 0 20px" }}>
        Emails that can sign in to the submission portal. Changes update the Notion allowlist and
        the Supabase mirror together.
      </p>

      <form className="admin-allowlist__add" onSubmit={handleAdd}>
        <input
          type="email"
          className="admin-search"
          placeholder="email@example.com"
          value={newEmail}
          onChange={(event) => setNewEmail(event.target.value)}
        />
        <button type="submit" className="admin-primary-button" disabled={isSaving || !newEmail.trim()}>
          {isSaving ? "Adding…" : "Add user"}
        </button>
      </form>

      {error ? <div className="admin-banner admin-banner--error">{error}</div> : null}
      {notice ? <div className="admin-banner admin-banner--success">{notice}</div> : null}

      <div className="admin-table-wrap" style={{ marginTop: 16 }}>
        {isLoading ? (
          <div className="admin-loading">Loading allowlist…</div>
        ) : users.length === 0 ? (
          <div className="admin-empty">No allowed users yet.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Added</th>
                <th>Last Edited</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.pageId}>
                  <td>
                    {editingId === user.pageId ? (
                      <input
                        autoFocus
                        type="email"
                        className="admin-allowlist__edit"
                        value={editEmail}
                        onChange={(event) => setEditEmail(event.target.value)}
                        onBlur={() => handleEditSave(user)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            handleEditSave(user);
                          }

                          if (event.key === "Escape") {
                            setEditingId(null);
                          }
                        }}
                      />
                    ) : (
                      <strong>{user.email}</strong>
                    )}
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>{formatDate(user.updatedAt)}</td>
                  <td className="admin-allowlist__actions">
                    <button
                      type="button"
                      className="admin-ghost-button"
                      onClick={() => {
                        setEditingId(user.pageId);
                        setEditEmail(user.email);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="admin-ghost-button admin-allowlist__delete"
                      onClick={() => handleDelete(user)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
