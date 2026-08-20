"use client";

import { useEffect, useState } from "react";
import {
  ADULT_VIDEO_OPTIONS,
  ALTS_STEMS_OPTIONS,
  CONTAINS_SAMPLE_OPTIONS,
  DEAL_TYPE_OPTIONS,
  EXPLICIT_OPTIONS,
  GENRE_OPTIONS,
  INITIAL_FORM_VALUES,
  INITIAL_PUBLISHING_VALUES,
  INITIAL_VIDEO_VALUES,
  INTERNAL_EMAIL_DOMAIN,
  RELEASE_TYPES,
  STEP_DEFINITIONS,
  VIDEO_DSP_OPTIONS,
  VIDEO_PRODUCT_OPTIONS,
  WATERFALL_OPTIONS
} from "@/lib/release-config";
import { ALL_SUBGENRES, SUBGENRE_GROUPS } from "@/lib/subgenres";
import { getMissingFieldsForMatch } from "@/lib/release-fields";
import FugaSopModal from "@/components/fuga-sop-modal";

const FORM_KIND_TITLES = {
  release: "Release (Distribution)",
  video: "Video",
  publishing: "Publishing (Audio)"
};

const ARTIST_LIST_HELP = "List every artist exactly as it should appear on streaming services. Separate multiple artists with commas.";

// Supabase project cap. Raising the project's Storage limit raises this too.
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

function formatBytes(bytes) {
  if (!bytes) {
    return "";
  }

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);

  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

// Uploads straight from the browser to Supabase Storage. Routing files through
// the API instead would cap them at Vercel's 4.5 MB request-body limit.
function uploadToSignedUrl(signedUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("PUT", signedUrl, true);
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${request.status})`));
    request.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    request.send(file);
  });
}

function AssetUpload({ kind, label, accept, help, submissionId, asset, onChange, disabled }) {
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");

  async function handleFile(file) {
    if (!file) {
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`${formatBytes(file.size)} exceeds the ${formatBytes(MAX_UPLOAD_BYTES)} upload limit.`);
      return;
    }

    setError("");
    setProgress(0);

    try {
      const response = await fetch("/api/assets/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, kind, fileName: file.name })
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not start upload.");
      }

      await uploadToSignedUrl(result.signedUrl, file, setProgress);

      onChange({
        kind,
        storagePath: result.path,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size
      });
      setProgress(100);
    } catch (uploadError) {
      setError(uploadError.message);
      setProgress(null);
    }
  }

  return (
    <div className="field">
      <label className="field-label" htmlFor={`asset-${kind}`}>
        {label}
      </label>
      <input
        id={`asset-${kind}`}
        className="file-input"
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(event) => handleFile(event.target.files?.[0] || null)}
      />
      {progress !== null && progress < 100 ? (
        <div className="upload-progress">
          <div className="upload-progress__bar" style={{ width: `${progress}%` }} />
          <span>{progress}%</span>
        </div>
      ) : null}
      {asset ? (
        <div className="file-meta">
          <strong>Uploaded</strong>
          {asset.fileName} {asset.sizeBytes ? `(${formatBytes(asset.sizeBytes)})` : ""}
        </div>
      ) : null}
      {error ? <div className="field-help upload-error">{error}</div> : null}
      {help ? <div className="field-help">{help}</div> : null}
    </div>
  );
}

function GenreSelect({ id, value, onChange }) {
  // Legacy rows can hold free-text genres; keep them selectable so editing doesn't wipe the value.
  const isLegacyValue = Boolean(value) && !GENRE_OPTIONS.includes(value);

  return (
    <select id={id} className="select" value={value} onChange={onChange}>
      <option value="">Select genre</option>
      {isLegacyValue ? <option value={value}>{value}</option> : null}
      {GENRE_OPTIONS.map((option) => (
        <option value={option} key={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function SubgenreSelect({ id, value, onChange }) {
  // Legacy rows can hold free-text genres; keep them selectable so editing doesn't wipe the value.
  const isLegacyValue = Boolean(value) && !ALL_SUBGENRES.has(value);

  return (
    <select id={id} className="select" value={value} onChange={onChange}>
      <option value="">Select sub genre</option>
      {isLegacyValue ? <option value={value}>{value}</option> : null}
      {SUBGENRE_GROUPS.map((group) => (
        <optgroup label={group.label} key={group.label}>
          {group.options.map((option) => (
            <option value={option} key={`${group.label}-${option}`}>
              {option}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function CheckboxGroup({ options, values, onToggle }) {
  return (
    <div className="checkbox-group">
      {options.map((option) => (
        <label className="checkbox-option" key={option}>
          <input
            type="checkbox"
            checked={values.includes(option)}
            onChange={() => onToggle(option)}
          />
          <span>{option}</span>
        </label>
      ))}
    </div>
  );
}

function getTrackPreview(value) {
  return value
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .map((line, index) => `${index + 1}. ${line}`)
    .join("\n");
}

function getStepErrors(releaseType, formValues, files, stepId) {
  const errors = {};

  if (stepId === "song") {
    if (!formValues.title.trim()) {
      errors.title = "Title is required.";
    }

    if (!formValues.mainArtists.trim()) {
      errors.mainArtists = "Main artist is required.";
    }

    if (releaseType === "album" && !formValues.tracklist.trim()) {
      errors.tracklist = "Tracklist is required for Album / EP.";
    }

    if (!formValues.pLine.trim()) {
      errors.pLine = "P-Line is required.";
    }
  }

  if (stepId === "timeline") {
    if (!formValues.mainGenre.trim()) {
      errors.mainGenre = "Main genre is required.";
    }

    if (!formValues.releaseDate.trim()) {
      errors.releaseDate = "Release date is required.";
    }
  }

  if (stepId === "song" && releaseType === "single" && formValues.waterfallRelease === "Yes" && !formValues.waterfallTracklist.trim()) {
    errors.waterfallTracklist = "Provide the waterfall track order.";
  }

  return errors;
}

export default function PortalApp({ initialSession }) {
  const [session, setSession] = useState(initialSession);
  const [releaseType, setReleaseType] = useState("single");
  const [formKind, setFormKind] = useState("release");
  const [stepIndex, setStepIndex] = useState(0);
  const [formValues, setFormValues] = useState(INITIAL_FORM_VALUES);
  const [publishingValues, setPublishingValues] = useState(INITIAL_PUBLISHING_VALUES);
  const [videoValues, setVideoValues] = useState(INITIAL_VIDEO_VALUES);
  const [editingPageId, setEditingPageId] = useState("");
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());
  const [assets, setAssets] = useState({});
  const [existingAssets, setExistingAssets] = useState({
    lyrics: false,
    coverArt: false,
    thumbnail: false
  });
  const [files, setFiles] = useState({
    lyricsFile: null,
    coverArtFile: null,
    thumbnailFile: null
  });
  const [errors, setErrors] = useState({});
  const [showSop, setShowSop] = useState(false);
  const [status, setStatus] = useState({
    type: "idle",
    message: ""
  });
  const [isSuccessFading, setIsSuccessFading] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [view, setView] = useState("loading");

  const currentStep = STEP_DEFINITIONS[stepIndex];
  const trackPreview = getTrackPreview(releaseType === "album" ? formValues.tracklist : formValues.waterfallTracklist);
  const isAuthorized = Boolean(session?.authorized);
  const isInternal = Boolean(session?.email?.trim().toLowerCase().endsWith(INTERNAL_EMAIL_DOMAIN));

  useEffect(() => {
    if (!isAuthorized) {
      return;
    }

    let cancelled = false;

    async function loadSubmissions() {
      try {
        const response = await fetch("/api/submissions/list");
        const result = await response.json();

        if (cancelled) {
          return;
        }

        const matches = response.ok && result.matches ? result.matches : [];
        setSubmissions(matches);
        setView(matches.length ? "list" : "form");
      } catch {
        if (!cancelled) {
          setSubmissions([]);
          setView("form");
        }
      }
    }

    loadSubmissions();

    return () => {
      cancelled = true;
    };
  }, [isAuthorized]);

  useEffect(() => {
    if (status.type !== "success") {
      setIsSuccessFading(false);
      return;
    }

    const fadeTimer = window.setTimeout(() => {
      setIsSuccessFading(true);
    }, 5200);

    const clearTimer = window.setTimeout(() => {
      setStatus({
        type: "idle",
        message: ""
      });
      setIsSuccessFading(false);
    }, 6200);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [status]);

  function updateField(field, value) {
    setFormValues((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updatePublishingField(field, value) {
    setPublishingValues((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateVideoField(field, value) {
    setVideoValues((current) => ({
      ...current,
      [field]: value
    }));
  }

  function toggleListValue(updater, field, option) {
    updater((current) => ({
      ...current,
      [field]: current[field].includes(option)
        ? current[field].filter((item) => item !== option)
        : [...current[field], option]
    }));
  }

  function handleStepChange(nextIndex) {
    if (nextIndex > stepIndex) {
      const stepErrors = getStepErrors(releaseType, formValues, files, currentStep.id);

      if (Object.keys(stepErrors).length) {
        setErrors(stepErrors);
        return;
      }
    }

    setErrors({});
    setStepIndex(nextIndex);
  }

  function handleFormKeyDown(event) {
    if (event.key !== "Enter") {
      return;
    }

    if (event.target instanceof HTMLTextAreaElement) {
      return;
    }

    if (stepIndex < STEP_DEFINITIONS.length - 1) {
      event.preventDefault();
    }
  }

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    setSession(null);
    setStatus({
      type: "idle",
      message: ""
    });
  }

  function applyExistingSubmission(match) {
    const kind = match.kind || "release";

    setFormKind(kind);

    if (kind === "publishing") {
      setPublishingValues({ ...INITIAL_PUBLISHING_VALUES, ...match.formValues });
    } else if (kind === "video") {
      setVideoValues({ ...INITIAL_VIDEO_VALUES, ...match.formValues });
    } else {
      setReleaseType(match.releaseType || "album");
      setFormValues({ ...INITIAL_FORM_VALUES, ...match.formValues });
    }

    setEditingPageId(match.pageId);
    setSubmissionId(match.pageId);
    setAssets({});
    setExistingAssets({
      lyrics: false,
      coverArt: false,
      thumbnail: false,
      ...(match.existingAssets || {})
    });
    setFiles({
      lyricsFile: null,
      coverArtFile: null,
      thumbnailFile: null
    });
    setErrors({});
    setStatus({
      type: "idle",
      message: ""
    });
  }

  function clearEditingState() {
    setEditingPageId("");
    setExistingAssets({
      lyrics: false,
      coverArt: false,
      thumbnail: false
    });
  }

  function resetForms() {
    setSubmissionId(crypto.randomUUID());
    setAssets({});
    setFormValues(INITIAL_FORM_VALUES);
    setPublishingValues(INITIAL_PUBLISHING_VALUES);
    setVideoValues(INITIAL_VIDEO_VALUES);
    clearEditingState();
    setFiles({
      lyricsFile: null,
      coverArtFile: null,
      thumbnailFile: null
    });
    setErrors({});
    setStepIndex(0);
    setReleaseType("single");
  }

  function startNewSubmission() {
    resetForms();
    setFormKind("release");
    setStatus({
      type: "idle",
      message: ""
    });
    setView("form");
  }

  function handleEditSubmission(match) {
    applyExistingSubmission(match);
    setStepIndex(0);
    setView("form");
  }

  async function refreshSubmissions() {
    try {
      const response = await fetch("/api/submissions/list");
      const result = await response.json();
      const matches = response.ok && result.matches ? result.matches : [];
      setSubmissions(matches);
      return matches;
    } catch {
      return submissions;
    }
  }

  async function handleSubmit(event) {
    event?.preventDefault?.();

    if (stepIndex < STEP_DEFINITIONS.length - 1) {
      handleStepChange(stepIndex + 1);
      return;
    }

    const allErrors = STEP_DEFINITIONS.reduce((accumulator, step) => {
      return {
        ...accumulator,
        ...getStepErrors(releaseType, formValues, files, step.id)
      };
    }, {});

    if (Object.keys(allErrors).length) {
      setErrors(allErrors);
      setStatus({
        type: "error",
        message: "Please complete the required fields before submitting."
      });
      return;
    }

    setErrors({});
    setStatus({
      type: "loading",
      message: "Submitting release to Artist House..."
    });

    const payload = {
      ...formValues,
      pageId: editingPageId,
      releaseType,
      submissionId,
      assets: Object.values(assets)
    };

    const body = new FormData();
    body.append("payload", JSON.stringify(payload));

    if (files.lyricsFile) {
      body.append("lyricsFile", files.lyricsFile);
    }

    if (files.coverArtFile) {
      body.append("coverArtFile", files.coverArtFile);
    }

    const response = await fetch("/api/submit-release", {
      method: "POST",
      body
    });

    const result = await response.json();

    if (!response.ok) {
      setStatus({
        type: "error",
        message: result.error || "Submission failed."
      });
      return;
    }

    setStatus({
      type: "success",
      message: editingPageId
        ? "Release updated successfully."
        : "Release submitted successfully."
    });
    resetForms();

    const matches = await refreshSubmissions();

    if (matches.length) {
      setView("list");
    }
  }

  async function handleAuxSubmit(kind) {
    const values = kind === "publishing" ? publishingValues : videoValues;
    const auxErrors = {};

    if (!values.title.trim()) {
      auxErrors.title = "Title is required.";
    }

    if (!values.mainArtists.trim()) {
      auxErrors.mainArtists = "Main artist is required.";
    }

    if (Object.keys(auxErrors).length) {
      setErrors(auxErrors);
      setStatus({
        type: "error",
        message: "Please complete the required fields before submitting."
      });
      return;
    }

    setErrors({});
    setStatus({
      type: "loading",
      message: "Submitting to Artist House..."
    });

    const body = new FormData();
    body.append(
      "payload",
      JSON.stringify({
        ...values,
        pageId: editingPageId,
        formKind: kind,
        submissionId,
        assets: Object.values(assets)
      })
    );

    if (kind === "publishing") {
      if (files.lyricsFile) {
        body.append("lyricsFile", files.lyricsFile);
      }

      if (files.coverArtFile) {
        body.append("coverArtFile", files.coverArtFile);
      }
    }

    if (kind === "video" && files.thumbnailFile) {
      body.append("thumbnailFile", files.thumbnailFile);
    }

    const response = await fetch("/api/submit-release", {
      method: "POST",
      body
    });

    const result = await response.json();

    if (!response.ok) {
      setStatus({
        type: "error",
        message: result.error || "Submission failed."
      });
      return;
    }

    setStatus({
      type: "success",
      message: editingPageId ? "Submission updated successfully." : "Submission created successfully."
    });
    resetForms();
    setFormKind("release");

    const matches = await refreshSubmissions();

    if (matches.length) {
      setView("list");
    }
  }

  return (
    <div className="site-shell">
      {showSop ? <FugaSopModal onClose={() => setShowSop(false)} /> : null}
      <header className="header">
        <div className="header__inner">
          <a href="https://www.artisthouse.world/" aria-label="Artist House home" target="_blank" rel="noreferrer">
            <img
              src="https://images.squarespace-cdn.com/content/v1/6888fc28887005277bd77716/4873028a-2d73-466c-b924-0f9c72496d17/artisthouse_horizontal.png?format=1500w"
              alt="Artist House"
              className="logo"
            />
          </a>
          {session ? (
            <div className="header-actions">
              {isInternal ? (
                <a className="header-logout header-admin" href="/admin">
                  Admin
                </a>
              ) : null}
              <button className="header-logout" type="button" onClick={handleLogout}>
                Log Out
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <main id="top">
        <section className={`section section--portal ${!isAuthorized ? "section--portal-centered" : ""}`} id="portal">
          <div>
              {!session ? (
                <div className="auth-card">
                  <h2 className="auth-title">Sign in to open the Artist House portal.</h2>
                  <p>
                    Access is limited to approved emails. After sign-in, the portal will check
                    whether your Google account is registered.
                  </p>
                  <a className="button button--solid" href="/api/auth/google/start">
                    Continue with Google
                  </a>
                </div>
              ) : null}

              {session && !isAuthorized ? (
                <div className="auth-card">
                  <div className="auth-label">Access Requested</div>
                  <h2 className="denied-title">You have requested access, please wait for permission.</h2>
                  <p className="denied-copy">
                    Signed in as {session.email}. Feel free to follow up with{" "}
                    <a href="mailto:brandon@artisthouse.world">brandon@artisthouse.world</a>. Thank you
                    for your patience.
                  </p>
                  <button className="button" onClick={handleLogout} type="button">
                    Sign Out
                  </button>
                </div>
              ) : null}

              {isAuthorized && view === "loading" ? (
                <div className="auth-card">
                  <h2 className="auth-title">Loading your submissions...</h2>
                  <p>Retrieving your releases...</p>
                </div>
              ) : null}

              {isAuthorized && view === "list" ? (
                <>
                  <div className="release-switcher">
                    <div className="eyebrow">Authorized Session</div>
                    <h2 className="portal-title">Welcome back{session.name ? `, ${session.name}` : ""}.</h2>
                    <p className="portal-copy">
                      Signed in as {session.email}. Review your submissions to date, edit an existing
                      release, or start a new one.
                    </p>
                  </div>

                  <div className="step-panel">
                    {status.type === "success" ? <div className={`success-banner ${isSuccessFading ? "is-fading" : ""}`}>{status.message}</div> : null}
                    <div className="submissions-header">
                      <h3 className="step-title">Your Submissions</h3>
                      <button className="button button--solid submissions-new" type="button" onClick={startNewSubmission}>
                        + New Submission
                      </button>
                    </div>
                    <div className="submissions-table-wrap">
                      <table className="submissions-table">
                        <thead>
                          <tr>
                            <th>Title</th>
                            <th>Artist</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Release Date</th>
                            <th>Missing Info</th>
                            <th>Last Updated</th>
                            <th aria-label="Actions"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {submissions.map((match) => {
                            const missingFields = getMissingFieldsForMatch(match);

                            return (
                              <tr key={match.pageId}>
                                <td>{match.formValues.title || "Untitled release"}</td>
                                <td>{match.formValues.mainArtists || "—"}</td>
                                <td>
                                  {match.kind === "publishing"
                                    ? "Publishing"
                                    : match.kind === "video"
                                      ? "Video"
                                      : match.releaseType === "single"
                                        ? "Single"
                                        : "Album / EP"}
                                </td>
                                <td>{match.status || "—"}</td>
                                <td>{match.formValues.releaseDate || "—"}</td>
                                <td className="submissions-missing">
                                  {missingFields.length ? missingFields.join(", ") : "Complete"}
                                </td>
                                <td>{new Date(match.updatedAt).toLocaleDateString()}</td>
                                <td>
                                  <button className="ghost-button" type="button" onClick={() => handleEditSubmission(match)}>
                                    Edit
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}

              {isAuthorized && view === "form" ? (
                <>
                  <div className="release-switcher">
                    <div className="eyebrow">Authorized Session</div>
                    <h2 className="portal-title">Welcome back{session.name ? `, ${session.name}` : ""}.</h2>
                    <p className="portal-copy">
                      Signed in as {session.email}. Choose the release format before moving through
                      the submission tabs.
                    </p>
                    {submissions.length ? (
                      <button className="ghost-button" type="button" onClick={() => setView("list")}>
                        ← Back to My Submissions
                      </button>
                    ) : null}
                    {editingPageId ? (
                      <div className="field-help">
                        Editing existing{" "}
                        {formKind === "release"
                          ? releaseType === "single"
                            ? "Single"
                            : "Album / EP"
                          : FORM_KIND_TITLES[formKind]}{" "}
                        submission. Submission type is locked while editing.
                      </div>
                    ) : null}
                    <div className="release-switcher__grid">
                        {Object.entries(FORM_KIND_TITLES)
                          .filter(([kind]) => kind !== "publishing" || isInternal)
                          .map(([kind, label]) => (
                          <button
                            type="button"
                            key={kind}
                            className={`release-option ${formKind === kind ? "is-active" : ""}`}
                            onClick={() => {
                              if (!editingPageId) {
                                setFormKind(kind);
                                setErrors({});
                              }
                            }}
                            disabled={Boolean(editingPageId)}
                          >
                            <strong>{label}</strong>
                          </button>
                        ))}
                      </div>
                    {formKind === "release" ? (
                      <div className="release-switcher__divider" aria-hidden="true" />
                    ) : null}
                    {formKind === "release" ? (
                    <div className="release-switcher__grid">
                      <button
                        type="button"
                        className={`release-option ${releaseType === "single" ? "is-active" : ""}`}
                        onClick={() => {
                          if (!editingPageId) {
                            setReleaseType("single");
                          }
                        }}
                        disabled={Boolean(editingPageId)}
                      >
                        <strong>Single</strong>
                      </button>
                      <button
                        type="button"
                        className={`release-option ${releaseType === "album" ? "is-active" : ""}`}
                        onClick={() => {
                          if (!editingPageId) {
                            setReleaseType("album");
                          }
                        }}
                        disabled={Boolean(editingPageId)}
                      >
                        <strong>Album / EP</strong>
                      </button>
                    </div>
                    ) : null}
                  </div>

                  {formKind === "release" ? (
                  <div className="step-panel" onKeyDown={handleFormKeyDown}>
                    <div className="tabs">
                      {STEP_DEFINITIONS.map((step, index) => (
                        <button
                          type="button"
                          key={step.id}
                          className={`tab-button ${index === stepIndex ? "is-active" : ""}`}
                          onClick={() => handleStepChange(index)}
                        >
                          <span className="tab-button__index">{String(index + 1).padStart(2, "0")}</span>
                          <strong>{step.label}</strong>
                          <span>{step.description}</span>
                        </button>
                      ))}
                    </div>

                    <div className="step-count">
                      Step {stepIndex + 1} of {STEP_DEFINITIONS.length}
                    </div>
                    <h3 className="step-title">{currentStep.label}</h3>
                    <p className="step-description">{currentStep.description}</p>

                    {status.type === "error" ? <div className="error-banner">{status.message}</div> : null}
                    {status.type === "success" ? <div className={`success-banner ${isSuccessFading ? "is-fading" : ""}`}>{status.message}</div> : null}
                    {status.type === "loading" ? <div className="success-banner">{status.message}</div> : null}

                  {currentStep.id === "song" ? (
                      <div className="field-grid">
                        <div className="field">
                          <label className="field-label" htmlFor="title">
                            Title <span className="required-mark">*</span>
                          </label>
                          <input
                            id="title"
                            className="text-input"
                            value={formValues.title}
                            onChange={(event) => updateField("title", event.target.value)}
                          />
                          {errors.title ? <div className="field-help">{errors.title}</div> : null}
                        </div>

                        {releaseType === "single" ? (
                          <div className="field">
                            <label className="field-label" htmlFor="releaseVersion">
                              Release Version
                            </label>
                            <input
                              id="releaseVersion"
                              className="text-input"
                              value={formValues.releaseVersion}
                              onChange={(event) => updateField("releaseVersion", event.target.value)}
                              placeholder="Remix, Extended, Acoustic, etc."
                            />
                          </div>
                        ) : null}

                        <div className="field">
                          <label className="field-label" htmlFor="mainArtists">
                            Main Artist(s) <span className="required-mark">*</span>
                          </label>
                          <input
                            id="mainArtists"
                            className="text-input"
                            value={formValues.mainArtists}
                            onChange={(event) => updateField("mainArtists", event.target.value)}
                          />
                          <div className="field-help">{ARTIST_LIST_HELP}</div>
                          {errors.mainArtists ? <div className="field-help">{errors.mainArtists}</div> : null}
                        </div>

                        <div className="field">
                          <label className="field-label" htmlFor="featuredArtists">
                            Featured Artist(s)
                          </label>
                          <input
                            id="featuredArtists"
                            className="text-input"
                            value={formValues.featuredArtists}
                            onChange={(event) => updateField("featuredArtists", event.target.value)}
                          />
                          <div className="field-help">{ARTIST_LIST_HELP}</div>
                        </div>

                        <div className="field field--full">
                          <label className="field-label" htmlFor="tracklist">
                            Tracklist
                            {releaseType === "album" ? <span className="required-mark"> *</span> : null}
                          </label>
                          {releaseType === "album" ? (
                            <>
                              <textarea
                                id="tracklist"
                                className="textarea"
                                value={formValues.tracklist}
                                onChange={(event) => updateField("tracklist", event.target.value)}
                                placeholder="Enter one track title per line."
                              />
                              {errors.tracklist ? <div className="field-help">{errors.tracklist}</div> : null}
                              {trackPreview ? (
                                <div className="track-preview">
                                  <strong>Numbered Preview</strong>
                                  {trackPreview}
                                </div>
                              ) : null}
                            </>
                          ) : (
                            <div className="field-help">
                              Waterfall releases are singles with multiple previously released singles or a single attached to a new release.
                            </div>
                          )}
                        </div>

                        <div className="field">
                          <label className="field-label" htmlFor="explicit">
                            {releaseType === "album" ? "Are any of the tracks explicit?" : "Is this release explicit?"}
                          </label>
                          <select
                            id="explicit"
                            className="select"
                            value={formValues.explicit}
                            onChange={(event) => updateField("explicit", event.target.value)}
                          >
                            {EXPLICIT_OPTIONS.map((option) => (
                              <option value={option} key={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>

                        {releaseType === "single" ? (
                          <div className="field">
                            <label className="field-label" htmlFor="waterfallRelease">
                              Waterfall Release? <span className="required-mark">*</span>
                            </label>
                            <select
                              id="waterfallRelease"
                              className="select"
                              value={formValues.waterfallRelease}
                              onChange={(event) => updateField("waterfallRelease", event.target.value)}
                            >
                              <option value="">Select one</option>
                              {WATERFALL_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                            <div className="field-help">
                              Waterfall releases are singles with multiple previously released singles or a single attached to a new release.
                            </div>
                          </div>
                        ) : null}

                        {releaseType === "single" && formValues.waterfallRelease === "Yes" ? (
                          <div className="field field--full">
                            <label className="field-label" htmlFor="waterfallTracklist">
                              Please indicate the titles and order of songs included in the release.
                            </label>
                            <textarea
                              id="waterfallTracklist"
                              className="textarea"
                              value={formValues.waterfallTracklist}
                              onChange={(event) => updateField("waterfallTracklist", event.target.value)}
                              placeholder="One track title per line."
                            />
                            {errors.waterfallTracklist ? <div className="field-help">{errors.waterfallTracklist}</div> : null}
                            {trackPreview ? (
                              <div className="track-preview">
                                <strong>Numbered Preview</strong>
                                {trackPreview}
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="field field--full">
                          <label className="field-label" htmlFor="pLine">
                            P-Line <span className="required-mark">*</span>
                          </label>
                          <input
                            id="pLine"
                            className="text-input"
                            value={formValues.pLine}
                            onChange={(event) => updateField("pLine", event.target.value)}
                          />
                          <div className="field-help">If Artist House release, keep "Artist House, LLC"</div>
                          {errors.pLine ? <div className="field-help">{errors.pLine}</div> : null}
                        </div>
                      </div>
                    ) : null}

                    {currentStep.id === "timeline" ? (
                      <div className="field-grid">
                        <div className="field">
                          <label className="field-label" htmlFor="mainGenre">
                            Main Genre <span className="required-mark">*</span>
                          </label>
                          <GenreSelect
                            id="mainGenre"
                            value={formValues.mainGenre}
                            onChange={(event) => updateField("mainGenre", event.target.value)}
                          />
                          {errors.mainGenre ? <div className="field-help">{errors.mainGenre}</div> : null}
                        </div>
                        <div className="field">
                          <label className="field-label" htmlFor="subGenre">
                            Sub Genre
                          </label>
                          <SubgenreSelect
                            id="subGenre"
                            value={formValues.subGenre}
                            onChange={(event) => updateField("subGenre", event.target.value)}
                          />
                        </div>
                        <div className="field">
                          <label className="field-label" htmlFor="secondaryGenre">
                            Secondary Genre
                          </label>
                          <GenreSelect
                            id="secondaryGenre"
                            value={formValues.secondaryGenre}
                            onChange={(event) => updateField("secondaryGenre", event.target.value)}
                          />
                        </div>
                        <div className="field">
                          <label className="field-label" htmlFor="secondarySubGenre">
                            Secondary Sub Genre
                          </label>
                          <SubgenreSelect
                            id="secondarySubGenre"
                            value={formValues.secondarySubGenre}
                            onChange={(event) => updateField("secondarySubGenre", event.target.value)}
                          />
                        </div>
                        <div className="field">
                          <label className="field-label" htmlFor="releaseDate">
                            Release Date <span className="required-mark">*</span>
                          </label>
                          <input
                            id="releaseDate"
                            className="text-input"
                            type="date"
                            value={formValues.releaseDate}
                            onChange={(event) => updateField("releaseDate", event.target.value)}
                          />
                          {errors.releaseDate ? <div className="field-help">{errors.releaseDate}</div> : null}
                        </div>
                        <div className="field">
                          <label className="field-label" htmlFor="preorderDate">
                            Preorder Date
                          </label>
                          <input
                            id="preorderDate"
                            className="text-input"
                            type="date"
                            value={formValues.preorderDate}
                            onChange={(event) => updateField("preorderDate", event.target.value)}
                          />
                        </div>
                        <div className="field">
                          <label className="field-label" htmlFor="recordingDate">
                            Recording Date
                          </label>
                          <input
                            id="recordingDate"
                            className="text-input"
                            type="date"
                            value={formValues.recordingDate}
                            onChange={(event) => updateField("recordingDate", event.target.value)}
                          />
                        </div>
                        <div className="field field--full">
                          <label className="field-label" htmlFor="socialReleaseDate">
                            Social’s Release Date
                          </label>
                          <input
                            id="socialReleaseDate"
                            className="text-input"
                            type="date"
                            value={formValues.socialReleaseDate}
                            onChange={(event) => updateField("socialReleaseDate", event.target.value)}
                          />
                          <div className="field-help">
                            Usually the TikTok sound and Facebook audio go live two weeks before the
                            official audio release unless this project needs a different date.
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {currentStep.id === "assets" ? (
                      <div className="field-grid">
                        <AssetUpload
                          kind="audio"
                          label="Upload Audio File (master)"
                          accept="audio/*,.wav,.mp3,.flac,.aiff"
                          help={`Uploads directly to Artist House storage. Max ${formatBytes(MAX_UPLOAD_BYTES)}.`}
                          submissionId={submissionId}
                          asset={assets.audio}
                          onChange={(asset) => setAssets((current) => ({ ...current, audio: asset }))}
                        />
                        <AssetUpload
                          kind="dolby_atmos"
                          label="Upload Dolby Atmos Mix"
                          accept="audio/*,.wav,.atmos"
                          submissionId={submissionId}
                          asset={assets.dolby_atmos}
                          onChange={(asset) => setAssets((current) => ({ ...current, dolby_atmos: asset }))}
                        />
                        <div className="field field--full">
                          <label className="field-label" htmlFor="audioFileLink">
                            Audio File(s) Link
                          </label>
                          <input
                            id="audioFileLink"
                            className="text-input"
                            type="url"
                            value={formValues.audioFileLink}
                            onChange={(event) => updateField("audioFileLink", event.target.value)}
                            placeholder="https://"
                          />
                          <div className="field-help">
                            Optional if you uploaded the audio file above -- the upload fills this in
                            automatically with a permanent Artist House link.
                          </div>
                        </div>
                        <div className="field">
                          <label className="field-label" htmlFor="lyricsUrl">
                            Lyrics URL
                          </label>
                          <input
                            id="lyricsUrl"
                            className="text-input"
                            type="url"
                            value={formValues.lyricsUrl}
                            onChange={(event) => updateField("lyricsUrl", event.target.value)}
                            placeholder="https://"
                          />
                        </div>
                        <div className="field">
                          <label className="field-label" htmlFor="lyricsFile">
                            Attach Lyrics
                          </label>
                          <input
                            id="lyricsFile"
                            className="file-input"
                            type="file"
                            onChange={(event) =>
                              setFiles((current) => ({
                                ...current,
                                lyricsFile: event.target.files?.[0] || null
                              }))
                            }
                          />
                          {files.lyricsFile ? (
                            <div className="file-meta">
                              <strong>Selected File</strong>
                              {files.lyricsFile.name}
                            </div>
                          ) : null}
                          {editingPageId && existingAssets.lyrics && !files.lyricsFile ? (
                            <div className="field-help">An existing lyrics attachment will be kept unless you replace it.</div>
                          ) : null}
                        </div>
                        <div className="field">
                          <label className="field-label" htmlFor="coverArtUrl">
                            Cover Art URL
                          </label>
                          <input
                            id="coverArtUrl"
                            className="text-input"
                            type="url"
                            value={formValues.coverArtUrl}
                            onChange={(event) => updateField("coverArtUrl", event.target.value)}
                            placeholder="https://"
                          />
                        </div>
                        <div className="field">
                          <label className="field-label" htmlFor="coverArtFile">
                            Attach Cover Art
                          </label>
                          <input
                            id="coverArtFile"
                            className="file-input"
                            type="file"
                            accept="image/*"
                            onChange={(event) =>
                              setFiles((current) => ({
                                ...current,
                                coverArtFile: event.target.files?.[0] || null
                              }))
                            }
                          />
                          {files.coverArtFile ? (
                            <div className="file-meta">
                              <strong>Selected File</strong>
                              {files.coverArtFile.name}
                            </div>
                          ) : null}
                          {editingPageId && existingAssets.coverArt && !files.coverArtFile ? (
                            <div className="field-help">An existing cover art attachment will be kept unless you replace it.</div>
                          ) : null}
                        </div>
                        <div className="field">
                          <label className="field-label" htmlFor="dolbyAtmosLink">
                            Dolby Atmos Mix Link
                          </label>
                          <input
                            id="dolbyAtmosLink"
                            className="text-input"
                            type="url"
                            value={formValues.dolbyAtmosLink}
                            onChange={(event) => updateField("dolbyAtmosLink", event.target.value)}
                            placeholder="https://"
                          />
                        </div>
                        <div className="field">
                          <label className="field-label" htmlFor="appleMotionArtLink">
                            Apple Motion Art Link
                          </label>
                          <input
                            id="appleMotionArtLink"
                            className="text-input"
                            type="url"
                            value={formValues.appleMotionArtLink}
                            onChange={(event) => updateField("appleMotionArtLink", event.target.value)}
                            placeholder="https://"
                          />
                        </div>
                      </div>
                    ) : null}

                    {currentStep.id === "publishing" ? (
                      <div className="field-grid">
                        <div className="field field--full">
                          <label className="field-label" htmlFor="writersSplits">
                            Writer(s) and Splits
                          </label>
                          <textarea
                            id="writersSplits"
                            className="textarea"
                            value={formValues.writersSplits}
                            onChange={(event) => updateField("writersSplits", event.target.value)}
                          />
                        </div>
                        <div className="field field--full">
                          <label className="field-label" htmlFor="publisherInformation">
                            Publisher Information
                          </label>
                          <textarea
                            id="publisherInformation"
                            className="textarea"
                            value={formValues.publisherInformation}
                            onChange={(event) => updateField("publisherInformation", event.target.value)}
                          />
                        </div>
                        <div className="field field--full">
                          <label className="field-label" htmlFor="producerCredits">
                            Producer(s) / Other Credits
                          </label>
                          <textarea
                            id="producerCredits"
                            className="textarea"
                            value={formValues.producerCredits}
                            onChange={(event) => updateField("producerCredits", event.target.value)}
                          />
                        </div>
                        <div className="field field--full">
                          <label className="field-label" htmlFor="notes">
                            Any Other Notes / Special Requests
                          </label>
                          <textarea
                            id="notes"
                            className="textarea"
                            value={formValues.notes}
                            onChange={(event) => updateField("notes", event.target.value)}
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="step-actions">
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={stepIndex === 0}
                        onClick={() => handleStepChange(stepIndex - 1)}
                      >
                        Previous
                      </button>
                      {stepIndex < STEP_DEFINITIONS.length - 1 ? (
                        <button className="button button--solid" type="button" onClick={() => handleStepChange(stepIndex + 1)}>
                          Continue
                        </button>
                      ) : (
                        <button className="button button--solid" type="button" onClick={handleSubmit} disabled={status.type === "loading"}>
                          {status.type === "loading" ? (editingPageId ? "Updating..." : "Submitting...") : editingPageId ? "Update Release" : "Submit Release"}
                        </button>
                      )}
                    </div>
                  </div>
                  ) : null}

                  {formKind === "publishing" ? (
                  <div className="step-panel">
                    <h3 className="step-title">Audio Release Submission (Publishing)</h3>
                    <p className="step-description">
                      Check the Release Schedule first to avoid duplicate submissions. This form is for
                      publishing audio releases stored in DISCO. Leave optional questions blank and update
                      them later by editing the submission.
                    </p>

                    {status.type === "error" ? <div className="error-banner">{status.message}</div> : null}
                    {status.type === "success" ? <div className={`success-banner ${isSuccessFading ? "is-fading" : ""}`}>{status.message}</div> : null}
                    {status.type === "loading" ? <div className="success-banner">{status.message}</div> : null}

                    <div className="field-grid">
                      <div className="field">
                        <label className="field-label" htmlFor="pubTitle">
                          Title <span className="required-mark">*</span>
                        </label>
                        <input
                          id="pubTitle"
                          className="text-input"
                          value={publishingValues.title}
                          onChange={(event) => updatePublishingField("title", event.target.value)}
                        />
                        {errors.title ? <div className="field-help">{errors.title}</div> : null}
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor="pubReleaseVersion">
                          Release Version
                        </label>
                        <input
                          id="pubReleaseVersion"
                          className="text-input"
                          value={publishingValues.releaseVersion}
                          onChange={(event) => updatePublishingField("releaseVersion", event.target.value)}
                          placeholder="Remix, Extended, etc."
                        />
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor="pubMainArtists">
                          Main Artist(s) <span className="required-mark">*</span>
                        </label>
                        <input
                          id="pubMainArtists"
                          className="text-input"
                          value={publishingValues.mainArtists}
                          onChange={(event) => updatePublishingField("mainArtists", event.target.value)}
                        />
                        <div className="field-help">{ARTIST_LIST_HELP}</div>
                        {errors.mainArtists ? <div className="field-help">{errors.mainArtists}</div> : null}
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor="pubFeaturedArtists">
                          Featured Artist(s)
                        </label>
                        <input
                          id="pubFeaturedArtists"
                          className="text-input"
                          value={publishingValues.featuredArtists}
                          onChange={(event) => updatePublishingField("featuredArtists", event.target.value)}
                        />
                        <div className="field-help">{ARTIST_LIST_HELP}</div>
                      </div>
                      <div className="field field--full">
                        <label className="field-label" htmlFor="pubLabelInfo">
                          Label Info
                        </label>
                        <input
                          id="pubLabelInfo"
                          className="text-input"
                          value={publishingValues.labelInfo}
                          onChange={(event) => updatePublishingField("labelInfo", event.target.value)}
                        />
                      </div>
                      <div className="field field--full">
                        <label className="field-label">
                          Alts/stems included in the files that should be uploaded to DISCO
                        </label>
                        <CheckboxGroup
                          options={ALTS_STEMS_OPTIONS}
                          values={publishingValues.altsStems}
                          onToggle={(option) => toggleListValue(setPublishingValues, "altsStems", option)}
                        />
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor="pubReleaseDate">
                          Release Date
                        </label>
                        <input
                          id="pubReleaseDate"
                          className="text-input"
                          type="date"
                          value={publishingValues.releaseDate}
                          onChange={(event) => updatePublishingField("releaseDate", event.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor="pubCreationDate">
                          Creation Date
                        </label>
                        <input
                          id="pubCreationDate"
                          className="text-input"
                          type="date"
                          value={publishingValues.creationDate}
                          onChange={(event) => updatePublishingField("creationDate", event.target.value)}
                        />
                      </div>
                      <div className="field field--full">
                        <label className="field-label" htmlFor="pubAudioFileLink">
                          Audio File(s) Link
                        </label>
                        <input
                          id="pubAudioFileLink"
                          className="text-input"
                          type="url"
                          value={publishingValues.audioFileLink}
                          onChange={(event) => updatePublishingField("audioFileLink", event.target.value)}
                          placeholder="https://"
                        />
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor="pubLyricsFile">
                          Attach Lyrics
                        </label>
                        <input
                          id="pubLyricsFile"
                          className="file-input"
                          type="file"
                          onChange={(event) =>
                            setFiles((current) => ({
                              ...current,
                              lyricsFile: event.target.files?.[0] || null
                            }))
                          }
                        />
                        {files.lyricsFile ? (
                          <div className="file-meta">
                            <strong>Selected File</strong>
                            {files.lyricsFile.name}
                          </div>
                        ) : null}
                        {editingPageId && existingAssets.lyrics && !files.lyricsFile ? (
                          <div className="field-help">An existing lyrics attachment will be kept unless you replace it.</div>
                        ) : null}
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor="pubCoverArtFile">
                          Attach Cover Art
                        </label>
                        <input
                          id="pubCoverArtFile"
                          className="file-input"
                          type="file"
                          accept="image/*"
                          onChange={(event) =>
                            setFiles((current) => ({
                              ...current,
                              coverArtFile: event.target.files?.[0] || null
                            }))
                          }
                        />
                        {files.coverArtFile ? (
                          <div className="file-meta">
                            <strong>Selected File</strong>
                            {files.coverArtFile.name}
                          </div>
                        ) : null}
                        {editingPageId && existingAssets.coverArt && !files.coverArtFile ? (
                          <div className="field-help">An existing cover art attachment will be kept unless you replace it.</div>
                        ) : null}
                      </div>
                      <div className="field field--full">
                        <label className="field-label" htmlFor="pubAhWritersSplits">
                          Artist House Writer(s) &amp; Splits
                        </label>
                        <textarea
                          id="pubAhWritersSplits"
                          className="textarea"
                          value={publishingValues.ahWritersSplits}
                          onChange={(event) => updatePublishingField("ahWritersSplits", event.target.value)}
                        />
                        <div className="field-help">Please include FULL NAMES.</div>
                      </div>
                      <div className="field field--full">
                        <label className="field-label" htmlFor="pubTpWritersSplits">
                          Third Party Writer(s) &amp; Splits
                        </label>
                        <textarea
                          id="pubTpWritersSplits"
                          className="textarea"
                          value={publishingValues.tpWritersSplits}
                          onChange={(event) => updatePublishingField("tpWritersSplits", event.target.value)}
                        />
                        <div className="field-help">Please include FULL NAMES.</div>
                      </div>
                      <div className="field field--full">
                        <label className="field-label" htmlFor="pubAhWritersPubInfo">
                          Artist House Writer(s) Publisher Information
                        </label>
                        <textarea
                          id="pubAhWritersPubInfo"
                          className="textarea"
                          value={publishingValues.ahWritersPubInfo}
                          onChange={(event) => updatePublishingField("ahWritersPubInfo", event.target.value)}
                        />
                      </div>
                      <div className="field field--full">
                        <label className="field-label" htmlFor="pubTpWritersPubInfo">
                          Third Party Writer(s) Publisher Information
                        </label>
                        <textarea
                          id="pubTpWritersPubInfo"
                          className="textarea"
                          value={publishingValues.tpWritersPubInfo}
                          onChange={(event) => updatePublishingField("tpWritersPubInfo", event.target.value)}
                        />
                      </div>
                      <div className="field field--full">
                        <label className="field-label">Deal Type</label>
                        <CheckboxGroup
                          options={DEAL_TYPE_OPTIONS}
                          values={publishingValues.dealType}
                          onToggle={(option) => toggleListValue(setPublishingValues, "dealType", option)}
                        />
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor="pubIsrc">
                          ISRC
                        </label>
                        <input
                          id="pubIsrc"
                          className="text-input"
                          value={publishingValues.isrc}
                          onChange={(event) => updatePublishingField("isrc", event.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor="pubContainsSample">
                          Contains Sample?
                        </label>
                        <select
                          id="pubContainsSample"
                          className="select"
                          value={publishingValues.containsSample}
                          onChange={(event) => updatePublishingField("containsSample", event.target.value)}
                        >
                          <option value="">Select one</option>
                          {CONTAINS_SAMPLE_OPTIONS.map((option) => (
                            <option value={option} key={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                      {publishingValues.containsSample === "Yes" ? (
                        <div className="field field--full">
                          <label className="field-label" htmlFor="pubSampleTitleWriters">
                            Please provide the sample title &amp; writers
                          </label>
                          <textarea
                            id="pubSampleTitleWriters"
                            className="textarea"
                            value={publishingValues.sampleTitleWriters}
                            onChange={(event) => updatePublishingField("sampleTitleWriters", event.target.value)}
                          />
                        </div>
                      ) : null}
                      <div className="field field--full">
                        <label className="field-label" htmlFor="pubNotes">
                          Any Other Notes / Special Requests
                        </label>
                        <textarea
                          id="pubNotes"
                          className="textarea"
                          value={publishingValues.notes}
                          onChange={(event) => updatePublishingField("notes", event.target.value)}
                        />
                      </div>
                    </div>

                    <div className="step-actions">
                      <span />
                      <button
                        className="button button--solid"
                        type="button"
                        onClick={() => handleAuxSubmit("publishing")}
                        disabled={status.type === "loading"}
                      >
                        {status.type === "loading"
                          ? editingPageId
                            ? "Updating..."
                            : "Submitting..."
                          : editingPageId
                            ? "Update Submission"
                            : "Submit"}
                      </button>
                    </div>
                  </div>
                  ) : null}

                  {formKind === "video" ? (
                  <div className="step-panel">
                    <h3 className="step-title">Video Release Submission</h3>
                    <p className="step-description">
                      Check the Release Schedule first to avoid duplicate submissions. This form is for
                      video releases distributed through Artist House. See the{" "}
                      <button type="button" className="sop-link" onClick={() => setShowSop(true)}>
                        Video Delivery SOP
                      </button>{" "}
                      for requirements before submitting.
                    </p>

                    {status.type === "error" ? <div className="error-banner">{status.message}</div> : null}
                    {status.type === "success" ? <div className={`success-banner ${isSuccessFading ? "is-fading" : ""}`}>{status.message}</div> : null}
                    {status.type === "loading" ? <div className="success-banner">{status.message}</div> : null}

                    <div className="field-grid">
                      <div className="field">
                        <label className="field-label" htmlFor="vidTitle">
                          Title <span className="required-mark">*</span>
                        </label>
                        <input
                          id="vidTitle"
                          className="text-input"
                          value={videoValues.title}
                          onChange={(event) => updateVideoField("title", event.target.value)}
                        />
                        {errors.title ? <div className="field-help">{errors.title}</div> : null}
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor="vidMainArtists">
                          Main Artist(s) <span className="required-mark">*</span>
                        </label>
                        <input
                          id="vidMainArtists"
                          className="text-input"
                          value={videoValues.mainArtists}
                          onChange={(event) => updateVideoField("mainArtists", event.target.value)}
                        />
                        <div className="field-help">{ARTIST_LIST_HELP}</div>
                        {errors.mainArtists ? <div className="field-help">{errors.mainArtists}</div> : null}
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor="vidFeaturedArtists">
                          Featured Artist(s)
                        </label>
                        <input
                          id="vidFeaturedArtists"
                          className="text-input"
                          value={videoValues.featuredArtists}
                          onChange={(event) => updateVideoField("featuredArtists", event.target.value)}
                        />
                        <div className="field-help">{ARTIST_LIST_HELP}</div>
                      </div>
                      <div className="field field--full">
                        <label className="field-label" htmlFor="vidProductVersion">
                          Please select what applies to this release
                        </label>
                        <select
                          id="vidProductVersion"
                          className="select"
                          value={videoValues.productVersions[0] || ""}
                          onChange={(event) =>
                            updateVideoField("productVersions", event.target.value ? [event.target.value] : [])
                          }
                        >
                          <option value="">Select one</option>
                          {videoValues.productVersions[0] && !VIDEO_PRODUCT_OPTIONS.includes(videoValues.productVersions[0]) ? (
                            <option value={videoValues.productVersions[0]}>{videoValues.productVersions[0]}</option>
                          ) : null}
                          {VIDEO_PRODUCT_OPTIONS.map((option) => (
                            <option value={option} key={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor="vidDistributor">
                          Distributor
                        </label>
                        <input
                          id="vidDistributor"
                          className="text-input"
                          value={videoValues.distributor}
                          onChange={(event) => updateVideoField("distributor", event.target.value)}
                        />
                      </div>
                      <AssetUpload
                        kind="video"
                        label="Upload Video File"
                        accept="video/*,.mp4,.mov"
                        help={`Uploads directly to Artist House storage. Max ${formatBytes(MAX_UPLOAD_BYTES)} -- use the link field below for larger files.`}
                        submissionId={submissionId}
                        asset={assets.video}
                        onChange={(asset) => setAssets((current) => ({ ...current, video: asset }))}
                      />
                      <div className="field">
                        <label className="field-label" htmlFor="vidVideoLink">
                          Link to Video
                        </label>
                        <input
                          id="vidVideoLink"
                          className="text-input"
                          type="url"
                          value={videoValues.videoLink}
                          onChange={(event) => updateVideoField("videoLink", event.target.value)}
                          placeholder="https://"
                        />
                      </div>
                      <div className="field field--full">
                        <label className="field-label">
                          Select any or all DSP's you'd like this release to be delivered to
                        </label>
                        <CheckboxGroup
                          options={VIDEO_DSP_OPTIONS}
                          values={videoValues.videoDsps}
                          onToggle={(option) => toggleListValue(setVideoValues, "videoDsps", option)}
                        />
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor="vidReleaseDate">
                          Release Date
                        </label>
                        <input
                          id="vidReleaseDate"
                          className="text-input"
                          type="date"
                          value={videoValues.releaseDate}
                          onChange={(event) => updateVideoField("releaseDate", event.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor="vidReleaseTime">
                          Release Time
                        </label>
                        <input
                          id="vidReleaseTime"
                          className="text-input"
                          value={videoValues.releaseTime}
                          onChange={(event) => updateVideoField("releaseTime", event.target.value)}
                          placeholder="Include time zone"
                        />
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor="vidPremiereDate">
                          Premiere Page Release Date
                        </label>
                        <input
                          id="vidPremiereDate"
                          className="text-input"
                          type="date"
                          value={videoValues.premiereDate}
                          onChange={(event) => updateVideoField("premiereDate", event.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor="vidPremiereTime">
                          Premiere Page Release Time
                        </label>
                        <input
                          id="vidPremiereTime"
                          className="text-input"
                          value={videoValues.premiereTime}
                          onChange={(event) => updateVideoField("premiereTime", event.target.value)}
                          placeholder="Include time zone"
                        />
                      </div>
                      <div className="field field--full">
                        <label className="field-label" htmlFor="vidAdultContent">
                          Is this video 18+?
                        </label>
                        <select
                          id="vidAdultContent"
                          className="select"
                          value={videoValues.adultContent}
                          onChange={(event) => updateVideoField("adultContent", event.target.value)}
                        >
                          <option value="">Select one</option>
                          {ADULT_VIDEO_OPTIONS.map((option) => (
                            <option value={option} key={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <div className="field-help">
                          Select "Yes" if the video prominently features suicide or self-harm (including
                          disordered eating), substance use or abuse, graphic, shocking, or violent content,
                          sexual content or nudity, or repeated/prolonged visual profanity or vulgar language.
                        </div>
                      </div>
                      <div className="field field--full">
                        <label className="field-label" htmlFor="vidThumbnailFile">
                          Attach Thumbnail
                        </label>
                        <input
                          id="vidThumbnailFile"
                          className="file-input"
                          type="file"
                          accept="image/*"
                          onChange={(event) =>
                            setFiles((current) => ({
                              ...current,
                              thumbnailFile: event.target.files?.[0] || null
                            }))
                          }
                        />
                        {files.thumbnailFile ? (
                          <div className="file-meta">
                            <strong>Selected File</strong>
                            {files.thumbnailFile.name}
                          </div>
                        ) : null}
                        {editingPageId && existingAssets.thumbnail && !files.thumbnailFile ? (
                          <div className="field-help">An existing thumbnail will be kept unless you replace it.</div>
                        ) : null}
                        <div className="field-help">
                          See the{" "}
                          <button type="button" className="sop-link" onClick={() => setShowSop(true)}>
                            Video Delivery SOP
                          </button>{" "}
                          for specs and dimensions. FOR APPLE MUSIC: the thumbnail
                          must be a still image from the video — if the official thumbnail differs from the
                          video, upload a separate thumbnail for Apple Music delivery.
                        </div>
                      </div>
                      <div className="field field--full">
                        <label className="field-label" htmlFor="vidDescription">
                          Video Description
                        </label>
                        <textarea
                          id="vidDescription"
                          className="textarea"
                          value={videoValues.videoDescription}
                          onChange={(event) => updateVideoField("videoDescription", event.target.value)}
                        />
                      </div>
                      <div className="field field--full">
                        <label className="field-label" htmlFor="vidKeywords">
                          Keywords
                        </label>
                        <textarea
                          id="vidKeywords"
                          className="textarea"
                          value={videoValues.keywords}
                          onChange={(event) => updateVideoField("keywords", event.target.value)}
                        />
                        <div className="field-help">Max 11 keywords.</div>
                      </div>
                      <div className="field field--full">
                        <label className="field-label" htmlFor="vidNotes">
                          Any Other Notes / Special Requests
                        </label>
                        <textarea
                          id="vidNotes"
                          className="textarea"
                          value={videoValues.notes}
                          onChange={(event) => updateVideoField("notes", event.target.value)}
                        />
                      </div>
                    </div>

                    <div className="step-actions">
                      <span />
                      <button
                        className="button button--solid"
                        type="button"
                        onClick={() => handleAuxSubmit("video")}
                        disabled={status.type === "loading"}
                      >
                        {status.type === "loading"
                          ? editingPageId
                            ? "Updating..."
                            : "Submitting..."
                          : editingPageId
                            ? "Update Submission"
                            : "Submit"}
                      </button>
                    </div>
                  </div>
                  ) : null}
                </>
              ) : null}
          </div>
        </section>
      </main>

      <footer className="footer">
        <div>
          <h4>ARTIST HOUSE</h4>
        </div>
        <div>
          <h4>Location</h4>
          <p>
            60 Charlton Street
            <br />
            New York, NY 10014
          </p>
        </div>
        <div>
          <h4>Connect</h4>
          <a href="https://www.instagram.com/artisthousehq" target="_blank" rel="noreferrer">
            Instagram
          </a>
          <br />
          <a href="https://www.tiktok.com/@artisthousehq" target="_blank" rel="noreferrer">
            TikTok
          </a>
        </div>
        <div>
          <h4>Terms & Privacy</h4>
          <a href="https://www.artisthouse.world/terms-and-conditions" target="_blank" rel="noreferrer">
            Terms & Conditions
          </a>
          <br />
          <a href="https://www.artisthouse.world/privacy-policy" target="_blank" rel="noreferrer">
            Privacy Policy
          </a>
        </div>
      </footer>
    </div>
  );
}
