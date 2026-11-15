"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, RotateCcw, X } from "lucide-react";
import type { Person, SpaceSnapshot } from "@/shared/types";
import {
  drawProfileCrop,
  exportProfileCrop,
  prepareProfilePhoto,
  profileCrop,
  type CropPosition,
  type PreparedProfilePhoto,
} from "./profile-photo-image";
import "./profile-photo.css";

const centered: CropPosition = { zoom: 1, horizontal: 0, vertical: 0 };
type Phase = "idle" | "reading" | "preparing" | "uploading" | "removing";

export function ProfilePhotoEditor({
  person,
  disabled = false,
}: {
  person: Person;
  disabled?: boolean;
}) {
  const client = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const currentPhoto = useRef<PreparedProfilePhoto | null>(null);
  const request = useRef<XMLHttpRequest | null>(null);
  const generation = useRef(0);
  const [photo, setPhoto] = useState<PreparedProfilePhoto | null>(null);
  const [position, setPosition] = useState<CropPosition>(centered);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const busy = phase !== "idle";
  const label =
    phase === "reading"
      ? "Opening photo…"
      : phase === "preparing"
        ? "Preparing photo…"
        : phase === "removing"
          ? "Restoring default…"
          : progress >= 100
            ? "Saving photo…"
            : `Uploading ${progress}%`;

  useEffect(
    () => () => {
      generation.current++;
      request.current?.abort();
      currentPhoto.current?.dispose();
    },
    [],
  );

  async function choose(file: File) {
    const attempt = ++generation.current;
    setPhase("reading");
    setError(null);
    setAnnouncement("");
    try {
      const prepared = await prepareProfilePhoto(file);
      if (attempt !== generation.current) {
        prepared.dispose();
        return;
      }
      currentPhoto.current?.dispose();
      currentPhoto.current = prepared;
      setPhoto(prepared);
      setPosition(centered);
    } catch (cause) {
      if (attempt === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "This photo couldn’t be opened.",
        );
    } finally {
      if (attempt === generation.current) setPhase("idle");
    }
  }
  function cancel() {
    if (busy) return;
    generation.current++;
    currentPhoto.current?.dispose();
    currentPhoto.current = null;
    setPhoto(null);
    setError(null);
  }
  async function finished(avatarMediaId: string | null, attempt: number) {
    if (attempt !== generation.current) return;
    client.setQueryData<SpaceSnapshot>(["space"], (previous) => {
      if (!previous || previous.me.id !== person.id) return previous;
      const update = (member: Person) =>
        member.id === person.id
          ? { ...member, avatarMediaId: avatarMediaId || undefined }
          : member;
      return {
        ...previous,
        me: update(previous.me),
        members: previous.members.map(update),
      };
    });
    await Promise.all([
      client.invalidateQueries({ queryKey: ["space"] }),
      client.invalidateQueries({ queryKey: ["account"] }),
    ]);
    if (attempt !== generation.current) return;
    currentPhoto.current?.dispose();
    currentPhoto.current = null;
    setPhoto(null);
    setPhase("idle");
    setAnnouncement(
      avatarMediaId ? "Profile photo saved." : "Default avatar restored.",
    );
  }
  function send(blob: Blob | null, attempt: number) {
    const xhr = new XMLHttpRequest();
    request.current = xhr;
    const fail = (message: string) => {
      if (attempt !== generation.current) return;
      setPhase("idle");
      setError(message);
    };
    xhr.open(blob ? "PUT" : "DELETE", "/api/profile/photo");
    if (blob) xhr.setRequestHeader("Content-Type", "image/jpeg");
    xhr.timeout = 60_000;
    xhr.upload.onprogress = (event) => {
      if (attempt === generation.current && event.lengthComputable)
        setProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (attempt !== generation.current) return;
      let body: {
        avatarMediaId?: string | null;
        error?: string | { message?: string };
      } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* A proxy can send a non-JSON response. */
      }
      if (
        xhr.status >= 200 &&
        xhr.status < 300 &&
        (blob
          ? typeof body.avatarMediaId === "string"
          : body.avatarMediaId === null)
      ) {
        setProgress(100);
        void finished(body.avatarMediaId || null, attempt);
      } else
        fail(
          typeof body.error === "string"
            ? body.error
            : body.error?.message || "Your photo didn’t save. Try again.",
        );
    };
    xhr.onerror = () =>
      fail("The connection dropped. Your crop is still here; try again.");
    xhr.ontimeout = () =>
      fail(
        "The upload took too long. Try again when your connection is ready.",
      );
    xhr.send(blob);
  }
  async function save() {
    if (!photo || busy) return;
    const attempt = ++generation.current;
    setPhase("preparing");
    setError(null);
    setProgress(0);
    try {
      const blob = await exportProfileCrop(photo, position);
      if (attempt !== generation.current) return;
      setPhase("uploading");
      send(blob, attempt);
    } catch (cause) {
      if (attempt === generation.current) {
        setPhase("idle");
        setError(
          cause instanceof Error
            ? cause.message
            : "Your photo couldn’t be prepared.",
        );
      }
    }
  }
  function useDefault() {
    if (busy) return;
    const attempt = ++generation.current;
    setPhase("removing");
    setError(null);
    setAnnouncement("");
    send(null, attempt);
  }
  return (
    <div className="profile-photo-editor">
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        aria-label="Choose profile photo"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void choose(file);
        }}
      />
      <div className="profile-photo-actions">
        <button
          type="button"
          className="secondary"
          disabled={busy || disabled}
          onClick={() => fileInput.current?.click()}
        >
          <Camera size={16} aria-hidden="true" />
          {person.avatarMediaId ? "Change photo" : "Upload photo"}
        </button>
        {person.avatarMediaId && (
          <button
            type="button"
            className="quiet"
            disabled={busy || disabled}
            onClick={useDefault}
          >
            Use default
          </button>
        )}
      </div>
      {!photo && busy && (
        <p className="profile-photo-status" role="status">
          {label}
        </p>
      )}
      {!photo && error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p className="profile-photo-status" aria-live="polite">
        {announcement}
      </p>
      {photo && (
        <ProfileCropDialog
          photo={photo}
          position={position}
          onPosition={setPosition}
          onClose={cancel}
          busy={busy}
          onSave={() => void save()}
          onChoose={() => fileInput.current?.click()}
          error={error}
          status={busy ? label : ""}
          progress={phase === "uploading" ? progress : null}
        />
      )}
    </div>
  );
}

function ProfileCropDialog({
  photo,
  position,
  onPosition,
  onClose,
  busy,
  onSave,
  onChoose,
  error,
  status,
  progress,
}: {
  photo: PreparedProfilePhoto;
  position: CropPosition;
  onPosition: (value: CropPosition) => void;
  onClose: () => void;
  busy: boolean;
  onSave: () => void;
  onChoose: () => void;
  error: string | null;
  status: string;
  progress: number | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const titleId = useId();
  const [previewError, setPreviewError] = useState<string | null>(null);
  const crop = profileCrop(photo.width, photo.height, position);
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    if (!preview.current) return;
    try {
      drawProfileCrop(preview.current, photo, position);
      setPreviewError(null);
    } catch (cause) {
      setPreviewError(
        cause instanceof Error ? cause.message : "The preview couldn’t load.",
      );
    }
  }, [photo, position]);
  return (
    <dialog
      ref={dialog}
      className="profile-photo-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header>
        <h2 id={titleId}>Your profile photo</h2>
        <button
          className="quiet"
          type="button"
          aria-label="Close photo editor"
          onClick={onClose}
          disabled={busy}
        >
          <X size={19} aria-hidden="true" />
        </button>
      </header>
      <canvas
        ref={preview}
        width={512}
        height={512}
        className="profile-photo-crop"
        role="img"
        aria-label="Circular profile photo preview"
      />
      <fieldset
        disabled={busy || !!previewError}
        className="profile-photo-crop-controls"
      >
        <label>
          Zoom<span>{position.zoom.toFixed(1)}×</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={position.zoom}
            onChange={(event) =>
              onPosition({ ...position, zoom: Number(event.target.value) })
            }
          />
        </label>
        <div className="profile-photo-position-controls">
          <label>
            Horizontal
            <input
              type="range"
              min={-100}
              max={100}
              step={1}
              value={position.horizontal}
              disabled={photo.width <= crop.side}
              onChange={(event) =>
                onPosition({
                  ...position,
                  horizontal: Number(event.target.value),
                })
              }
            />
          </label>
          <label>
            Vertical
            <input
              type="range"
              min={-100}
              max={100}
              step={1}
              value={position.vertical}
              disabled={photo.height <= crop.side}
              onChange={(event) =>
                onPosition({
                  ...position,
                  vertical: Number(event.target.value),
                })
              }
            />
          </label>
        </div>
        <div className="profile-photo-crop-tools">
          <button
            type="button"
            className="quiet"
            onClick={() => onPosition(centered)}
          >
            <RotateCcw size={14} aria-hidden="true" />
            Reset crop
          </button>
          <button type="button" className="quiet" onClick={onChoose}>
            Choose another
          </button>
        </div>
      </fieldset>
      {(error || previewError) && (
        <p className="form-error" role="alert">
          {error || previewError}
        </p>
      )}
      {status && (
        <div className="profile-photo-progress" role="status">
          {progress !== null && (
            <progress
              value={progress}
              max={100}
              aria-label="Profile photo upload"
            />
          )}
          <span>{status}</span>
        </div>
      )}
      <footer>
        <button
          type="button"
          className="quiet"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className="button"
          onClick={onSave}
          disabled={busy || !!previewError}
        >
          {busy ? "Saving…" : "Save photo"}
        </button>
      </footer>
    </dialog>
  );
}
