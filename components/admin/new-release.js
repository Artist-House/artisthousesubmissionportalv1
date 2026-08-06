"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ReleaseForm from "@/components/admin/release-form";
import { KIND_LABELS } from "@/lib/admin-form-config";
import {
  INITIAL_FORM_VALUES,
  INITIAL_PUBLISHING_VALUES,
  INITIAL_VIDEO_VALUES
} from "@/lib/release-config";

const KIND_DESCRIPTIONS = {
  audio: "Distribution releases: singles, EPs, and albums headed to DSPs.",
  video: "Video release submissions: music videos, visualizers, and more.",
  publishing: "Publishing submissions: splits, publisher info, and credits."
};

const BLANK_BY_KIND = {
  audio: {
    ...INITIAL_FORM_VALUES,
    releaseType: "single",
    status: "Not started",
    productVersion: "All DSPs (Main)"
  },
  video: {
    ...INITIAL_VIDEO_VALUES,
    status: "Not started"
  },
  publishing: {
    ...INITIAL_PUBLISHING_VALUES,
    status: "External"
  }
};

export default function NewRelease({ initialDate = "" }) {
  const router = useRouter();
  const [kind, setKind] = useState(null);

  async function handleSubmit(values) {
    const response = await fetch("/api/admin/releases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, payload: values })
    });

    const body = await response.json();

    if (!response.ok) {
      throw new Error(body?.error || "Could not create the release.");
    }

    if (body.id) {
      router.push(`/admin/releases/${encodeURIComponent(body.id)}`);
    } else {
      router.push("/admin/releases?view=upcoming");
    }

    return body;
  }

  function blankFor(kindKey) {
    const blank = { ...BLANK_BY_KIND[kindKey] };

    if (initialDate) {
      blank.releaseDate = initialDate;
    }

    return blank;
  }

  if (!kind) {
    return (
      <div>
        <h1 className="admin-detail__title">New Submission</h1>
        <p className="admin-count" style={{ margin: "8px 0 24px" }}>
          Choose the submission type.
        </p>
        <div className="admin-kind-picker">
          {Object.keys(KIND_LABELS).map((kindKey) => (
            <button key={kindKey} type="button" onClick={() => setKind(kindKey)}>
              <h3>{KIND_LABELS[kindKey]}</h3>
              <p>{KIND_DESCRIPTIONS[kindKey]}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <ReleaseForm
      kind={kind}
      initialValues={blankFor(kind)}
      onSubmit={handleSubmit}
      backHref="/admin/releases?view=upcoming"
    />
  );
}
