"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Mic, RotateCcw, Square } from "lucide-react";
import type { MediaUpload } from "./use-media-upload";

const MAX_SECONDS = 120;

export function VoiceRecorder({ upload }: { upload: MediaUpload }) {
  const [phase, setPhase] = useState<"idle" | "requesting" | "recording">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(true);
  const id = useId();

  function stopTracks() {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current) { recorder.current.onstop = null; recorder.current.ondataavailable = null; recorder.current.onerror = null; if (recorder.current.state !== "inactive") recorder.current.stop(); }
      stopTracks();
    };
  }, []);

  function stopRecording() {
    if (recorder.current?.state === "recording") recorder.current.stop();
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
  }

  async function startRecording() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError("Recording isn’t available in this browser. You can upload a recording instead."); return; }
    const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) { setError("This browser can’t record a supported audio format. Upload a WebM, MP4, or Ogg recording instead."); return; }
    setPhase("requesting");
    try {
      const input = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { input.getTracks().forEach(track => track.stop()); return; }
      stream.current = input;
      const next = new MediaRecorder(input, { mimeType, audioBitsPerSecond: 64_000 });
      recorder.current = next;
      const chunks: Blob[] = [];
      let failed = false;
      next.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      next.onstop = () => {
        stopTracks();
        if (!mounted.current) return;
        setPhase("idle");
        if (failed) return;
        const blob = new Blob(chunks, { type: next.mimeType });
        if (!blob.size) { setError("No audio was recorded. Try again or upload a recording."); return; }
        const extension = next.mimeType.includes("mp4") ? "m4a" : next.mimeType.includes("ogg") ? "ogg" : "webm";
        upload.upload(new File([blob], `voice-note.${extension}`, { type: next.mimeType }));
      };
      next.onerror = () => { failed = true; stopTracks(); if (mounted.current) { setPhase("idle"); setError("The recording stopped unexpectedly. Please try again."); } };
      upload.clear(); setSeconds(0); setPhase("recording");
      next.start(250);
      const started = Date.now();
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - started) / 1000);
        setSeconds(Math.min(elapsed, MAX_SECONDS));
        if (elapsed >= MAX_SECONDS) stopRecording();
      }, 250);
    } catch (cause) {
      stopTracks();
      if (!mounted.current) return;
      setPhase("idle");
      setError(cause instanceof DOMException && cause.name === "NotAllowedError" ? "Microphone access was denied. You can change your browser permissions or upload a recording." : "The microphone isn’t available. Check that it’s connected, or upload a recording.");
    }
  }

  return <div className="journal-recorder">
    <div className="journal-record-controls">
      {phase === "recording" ? <button type="button" className="secondary" onClick={stopRecording}><Square size={16} fill="currentColor" /> Stop recording</button> : <button type="button" className="secondary" disabled={phase === "requesting"} onClick={() => { void startRecording(); }}><Mic size={18} />{phase === "requesting" ? "Waiting for microphone…" : upload.file ? "Record again" : "Record a voice note"}</button>}
      <span className={phase === "recording" ? "journal-record-time is-recording" : "journal-record-time"} role="timer" aria-label="Recording duration">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</span>
    </div>
    <p className="muted journal-record-help">Up to 2 minutes. Recording stops when you close this window.</p>
    {upload.previewUrl && <audio controls src={upload.previewUrl} aria-label="Preview your voice note" />}
    {phase !== "recording" && phase !== "requesting" && <label className="journal-audio-file field" htmlFor={id}>Or upload a recording<input id={id} type="file" accept="audio/webm,audio/mp4,audio/ogg" onChange={event => { const file = event.target.files?.[0]; if (file) { setError(null); upload.upload(file); } event.target.value = ""; }} /><small>WebM, MP4, or Ogg · up to 10 MB</small></label>}
    {upload.status === "uploading" && <div className="journal-upload-progress" role="status"><progress max={100} value={upload.progress} aria-label="Audio upload progress" /><span>{upload.progress === 100 ? "Saving recording…" : `Uploading ${upload.progress}%`}</span></div>}
    {upload.status === "ready" && <p className="journal-upload-ready">Recording uploaded. Add a caption below.</p>}
    {(error || upload.error) && <div className="form-error" role="alert"><p>{error || upload.error}</p>{upload.error && upload.file && <button type="button" className="secondary" onClick={upload.retry}><RotateCcw size={15} /> Retry upload</button>}</div>}
  </div>;
}
