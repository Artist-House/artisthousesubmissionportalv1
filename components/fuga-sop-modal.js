"use client";

import { useEffect } from "react";

// FUGA Video Delivery SOP, shown in-portal so submitters never have to leave
// for Notion.
export default function FugaSopModal({ onClose }) {
  useEffect(() => {
    function handleKey(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="sop-modal__overlay" onClick={onClose} role="presentation">
      <div
        className="sop-modal"
        role="dialog"
        aria-modal="true"
        aria-label="FUGA Video Delivery SOP"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sop-modal__header">
          <h3>FUGA Video Delivery SOP</h3>
          <button type="button" className="sop-modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="sop-modal__body">
          <div className="sop-modal__callout">
            <strong>Delivery Deadline:</strong> Allow at least 10 days of lead time before the
            intended release date to send deliverables for VEVO distribution.
          </div>

          <h4>Artist House supports video delivery to these DSPs</h4>
          <ul>
            <li>VEVO CTV</li>
            <li>Spotify Video</li>
            <li>Apple Music/iTunes</li>
          </ul>
          <p>
            We will include VEVO YouTube automatically for artists not in the YouTube Ad Rev
            program.
          </p>
          <p>
            Only official music videos are accepted for Spotify Video/Apple Music. All video types
            can be delivered to VEVO.
          </p>

          <h4>Assets Needed</h4>

          <h5>Video File — Minimum Specs</h5>
          <p className="sop-modal__subhead">Video</p>
          <ul>
            <li>Compression Type: H.264 or ProRes</li>
            <li>File Format: .mov or .mp4</li>
            <li>Dimensions: 1920x1080</li>
            <li>Frame Rate: Native (No less than 23.98)</li>
            <li>Bit Rate: 20mbps (Minimum 7500 kb/s, if necessary)</li>
            <li>File must be de-interlaced (Please, no interlacing)</li>
            <li>Multi-pass encoding is preferred</li>
            <li>Do not use frame reordering in your encoding settings</li>
            <li>Do not include front or end slates, title or end cards, etc.</li>
          </ul>
          <p className="sop-modal__subhead">Audio</p>
          <ul>
            <li>Format: AAC</li>
            <li>Sample Rate: 44.100 kHz</li>
            <li>Bit Rate: 320 kbps CBR</li>
          </ul>

          <h5>Thumbnail Image</h5>
          <ul>
            <li>640x400 pixels (min size) — still image from the video itself</li>
            <li>
              For Apple Music: 1920x1080 pixels (min size, 16:9 ratio) — no black bars on the outer
              side of the picture, no other logos or text on this image
            </li>
          </ul>

          <h5>Description / Keywords</h5>
          <p className="sop-modal__subhead">Description — consider these best practices:</p>
          <ul>
            <li>Links to stream the song</li>
            <li>Quick artist bio (~2 sentences)</li>
            <li>Quick description of the song (~2 sentences)</li>
            <li>Credits to those who made the video</li>
            <li>Links to artist's social media pages/website</li>
            <li>Lyrics</li>
          </ul>
          <p className="sop-modal__subhead">Keywords</p>
          <ul>
            <li>2–3 keywords per video</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
