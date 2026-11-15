"use client";

import { useEffect, useRef, useState } from "react";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AUDIO_TYPES = new Set(["audio/webm", "audio/ogg", "audio/mp4"]);
export const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

export function useMediaUpload(kind: "image" | "audio" = "image") {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "ready" | "failed">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<XMLHttpRequest | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => () => { generation.current++; request.current?.abort(); }, []);

  function upload(nextFile: File) {
    const attempt = ++generation.current;
    request.current?.abort();
    setMediaId(null); setError(null); setProgress(0);
    const contentType = nextFile.type.split(";")[0].trim();
    if (!(kind === "image" ? IMAGE_TYPES : AUDIO_TYPES).has(contentType)) {
      setFile(null); setStatus("failed");
      setError(kind === "image" ? "Choose a JPEG, PNG, or WebP image." : "Choose a WebM, MP4, or Ogg recording.");
      return;
    }
    if (nextFile.size > MAX_MEDIA_BYTES || nextFile.size === 0) {
      setFile(null); setStatus("failed"); setError("Choose a file smaller than 10 MB that is not empty."); return;
    }
    setFile(nextFile); setStatus("uploading");
    const xhr = new XMLHttpRequest();
    request.current = xhr;
    const fail = (message: string) => {
      if (attempt !== generation.current) return;
      setStatus("failed"); setError(message);
    };
    xhr.open("POST", "/api/media");
    xhr.setRequestHeader("Content-Type", nextFile.type);
    xhr.timeout = 60_000;
    xhr.upload.onprogress = event => {
      if (attempt === generation.current && event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100));
    };
    xhr.onload = () => {
      if (attempt !== generation.current) return;
      let body: { id?: string; error?: string | { message?: string } } = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* A proxy may return an HTML error page. */ }
      if (xhr.status >= 200 && xhr.status < 300 && body.id) {
        setMediaId(body.id); setProgress(100); setStatus("ready");
      } else {
        const message = typeof body.error === "string" ? body.error : body.error?.message;
        fail(message || "The file didn’t upload. Your selection is still here; try again.");
      }
    };
    xhr.onerror = () => fail("The connection dropped. Your selection is still here; try again.");
    xhr.ontimeout = () => fail("The upload took too long. Check your connection and try again.");
    xhr.send(nextFile);
  }

  function clear() {
    generation.current++; request.current?.abort();
    setFile(null); setMediaId(null); setStatus("idle"); setProgress(0); setError(null);
  }

  return { file, previewUrl, mediaId, status, progress, error, upload, retry: () => { if (file) upload(file); }, clear };
}

export type MediaUpload = ReturnType<typeof useMediaUpload>;
