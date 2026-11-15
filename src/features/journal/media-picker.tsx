"use client";

import { useId, useState } from "react";
import { Check, ImagePlus, RotateCcw, X } from "lucide-react";
import type { MediaUpload } from "./use-media-upload";

export function MediaPicker({ upload, label = "Add a photo" }: { upload: MediaUpload; label?: string }) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  return <div className="journal-media-picker">
    <div className={`journal-dropzone${dragging ? " is-dragging" : ""}`}
      onDragOver={event => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) upload.upload(file); }}>
      {upload.previewUrl ? <img src={upload.previewUrl} alt="Selected photo preview" className="journal-upload-preview" /> : <ImagePlus size={28} strokeWidth={1.5} aria-hidden="true" />}
      <label className="secondary journal-upload-label" htmlFor={inputId}>{upload.file ? "Choose another photo" : label}</label>
      <input id={inputId} className="journal-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => {
        const selected = event.target.files?.[0]; if (selected) upload.upload(selected); event.target.value = "";
      }} />
      {!upload.file && <span className="muted">JPEG, PNG, or WebP · up to 10 MB</span>}
    </div>
    {upload.file && <div className="journal-file-state">
      <span className="journal-file-name">{upload.file.name}</span>
      {upload.status === "ready" && <span className="journal-upload-ready"><Check size={15} aria-hidden="true" /> Uploaded</span>}
      <button className="quiet journal-icon-button" type="button" onClick={upload.clear} aria-label="Remove selected photo"><X size={17} /></button>
    </div>}
    {upload.status === "uploading" && <div className="journal-upload-progress" role="status">
      <progress max={100} value={upload.progress} aria-label="Photo upload progress" />
      <span>{upload.progress === 100 ? "Saving photo…" : `Uploading ${upload.progress}%`}</span>
    </div>}
    {upload.error && <div className="form-error" role="alert"><p>{upload.error}</p>{upload.file && <button type="button" className="secondary" onClick={upload.retry}><RotateCcw size={15} /> Retry upload</button>}</div>}
  </div>;
}
