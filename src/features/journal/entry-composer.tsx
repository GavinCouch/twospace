"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ImagePlus, Link as LinkIcon, Mic, PenLine } from "lucide-react";
import { useAction } from "@/components/space-provider";
import type { Person } from "@/shared/types";
import { formatInZone, localToInstant } from "@/shared/time";
import { JournalDialog } from "./journal-dialog";
import { MediaPicker } from "./media-picker";
import { useMediaUpload } from "./use-media-upload";
import { VoiceRecorder } from "./voice-recorder";
import { noteSchema, safeExternalUrl } from "./journal-utils";
import "./composer.css";

const composerSchema = noteSchema
  .extend({
    kind: z.enum(["note", "photo", "link", "voice"]),
    url: z.string().max(2000, "Use a link under 2,000 characters."),
    revealLocal: z.string(),
  })
  .superRefine((values, context) => {
    if (values.kind === "note" && !values.body.trim())
      context.addIssue({
        code: "custom",
        path: ["body"],
        message: "Write something before saving the note.",
      });
    if (values.kind === "link" && !safeExternalUrl(values.url.trim()))
      context.addIssue({
        code: "custom",
        path: ["url"],
        message: "Enter a full http or https link.",
      });
  });
type ComposerValues = z.infer<typeof composerSchema>;
const defaults: ComposerValues = {
  kind: "note",
  title: "",
  body: "",
  url: "",
  collection: "",
  revealLocal: "",
};

export function EntryComposer({
  me,
  spaceId,
  collections,
  onClose,
  onSaved,
}: {
  me: Person;
  spaceId: string;
  collections: string[];
  onClose: () => void;
  onSaved?: () => void;
}) {
  const action = useAction();
  const upload = useMediaUpload();
  const audioUpload = useMediaUpload("audio");
  const [scheduled, setScheduled] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [draftAvailable, setDraftAvailable] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const loaded = useRef(false);
  const fieldId = useId();
  const key = `twospace:journal-draft:${spaceId}:${me.id}`;
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    setError,
    formState: { errors },
  } = useForm<ComposerValues>({
    resolver: zodResolver(composerSchema),
    defaultValues: defaults,
  });
  const kind = watch("kind");
  const revealLocal = watch("revealLocal");
  const body = watch("body");
  let scheduledPreview = "";
  if (scheduled && revealLocal) {
    try {
      scheduledPreview = formatInZone(
        localToInstant(revealLocal, me.timeZone),
        me.timeZone,
      );
    } catch {
      /* Validation explains invalid wall-clock times on submit. */
    }
  }

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) {
        const value = JSON.parse(saved) as Partial<ComposerValues>;
        const structural = noteSchema
          .extend({
            kind: z.enum(["note", "photo", "link", "voice"]),
            url: z.string().max(2000),
            revealLocal: z.string(),
          })
          .safeParse(value);
        if (structural.success) {
          reset(structural.data);
          setScheduled(Boolean(structural.data.revealLocal));
          setDetailsOpen(
            Boolean(structural.data.title || structural.data.collection),
          );
          setDraftAvailable(true);
        }
      }
    } catch {
      /* Draft storage can be disabled by the browser. */
    }
    loaded.current = true;
    const subscription = watch((value) => {
      if (!loaded.current) return;
      try {
        if (value.body || value.title || value.url) {
          sessionStorage.setItem(key, JSON.stringify(value));
          setDraftAvailable(true);
        } else {
          sessionStorage.removeItem(key);
          setDraftAvailable(false);
        }
      } catch {
        setDraftAvailable(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [key, reset, watch]);

  async function submit(values: ComposerValues) {
    setLocalError(null);
    let revealAt: string | undefined;
    if (scheduled) {
      try {
        revealAt = localToInstant(values.revealLocal, me.timeZone);
        if (Date.parse(revealAt) <= Date.now())
          throw new Error("Choose a time in the future.");
      } catch (cause) {
        setError("revealLocal", {
          message:
            cause instanceof Error
              ? cause.message
              : "Choose a valid date and time.",
        });
        return;
      }
    }
    if (values.kind === "photo" && !upload.mediaId) {
      setLocalError("Upload a photo before saving.");
      return;
    }
    if (values.kind === "voice" && !audioUpload.mediaId) {
      setLocalError("Finish recording and uploading before saving.");
      return;
    }
    try {
      await action.run("/api/entries", {
        kind: values.kind,
        body: values.body.trim(),
        title: values.title.trim(),
        collection: values.collection.trim(),
        ...(values.kind === "photo" ? { mediaId: upload.mediaId } : {}),
        ...(values.kind === "voice" ? { mediaId: audioUpload.mediaId } : {}),
        ...(values.kind === "link"
          ? { url: safeExternalUrl(values.url.trim()) }
          : {}),
        ...(revealAt ? { revealAt } : {}),
      });
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* Saving the entry does not depend on local storage. */
      }
      onSaved?.();
      onClose();
    } catch {
      /* The mutation error remains visible and the draft stays intact. */
    }
  }

  return (
    <JournalDialog title="New entry" onClose={onClose} busy={action.pending}>
      <form
        className="journal-compose-form"
        onSubmit={handleSubmit(submit)}
        aria-busy={action.pending}
        onChange={() => {
          setLocalError(null);
          action.clearError();
        }}
        noValidate
      >
        <fieldset className="journal-compose-fields" disabled={action.pending}>
          <fieldset className="journal-kind-picker">
            <legend className="journal-visually-hidden">Entry type</legend>
            {[
              { value: "note", label: "Note", Icon: PenLine },
              { value: "photo", label: "Photo", Icon: ImagePlus },
              { value: "link", label: "Link", Icon: LinkIcon },
              { value: "voice", label: "Voice", Icon: Mic },
            ].map(({ value, label, Icon }) => (
              <label
                key={value}
                className={kind === value ? "is-selected" : ""}
              >
                <input type="radio" value={value} {...register("kind")} />
                <Icon size={17} aria-hidden="true" />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          {kind === "photo" && <MediaPicker upload={upload} />}
          {kind === "voice" && <VoiceRecorder upload={audioUpload} />}
          {kind === "link" && (
            <label className="field" htmlFor={`${fieldId}-url`}>
              <span id={`${fieldId}-url-label`}>Link</span>
              <input
                id={`${fieldId}-url`}
                type="url"
                inputMode="url"
                placeholder="https://"
                autoComplete="off"
                {...register("url")}
                aria-invalid={Boolean(errors.url)}
                aria-labelledby={`${fieldId}-url-label`}
                aria-describedby={
                  errors.url ? `${fieldId}-url-error` : undefined
                }
              />
              {errors.url && (
                <span
                  className="journal-field-error"
                  id={`${fieldId}-url-error`}
                >
                  {errors.url.message}
                </span>
              )}
            </label>
          )}
          <label className="field" htmlFor={`${fieldId}-body`}>
            <span id={`${fieldId}-body-label`}>
              {kind === "photo"
                ? "Caption"
                : kind === "link"
                  ? "A note about it"
                  : kind === "voice"
                    ? "Caption or transcript"
                    : "Your note"}
            </span>
            <textarea
              id={`${fieldId}-body`}
              rows={6}
              data-initial-focus
              maxLength={6000}
              placeholder={
                kind === "photo"
                  ? "Add a caption…"
                  : kind === "voice"
                    ? "Add a transcript or caption…"
                    : "Write a note…"
              }
              {...register("body")}
              aria-invalid={Boolean(errors.body)}
              aria-labelledby={`${fieldId}-body-label`}
              aria-describedby={`${fieldId}-body-count${errors.body ? ` ${fieldId}-body-error` : ""}`}
            />
            {errors.body && (
              <span
                className="journal-field-error"
                id={`${fieldId}-body-error`}
              >
                {errors.body.message}
              </span>
            )}
            <small
              id={`${fieldId}-body-count`}
              className="journal-character-count"
            >
              {body.length.toLocaleString()} / 6,000
            </small>
          </label>
          <details
            className="journal-entry-details"
            open={detailsOpen}
            onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
          >
            <summary>Title and collection</summary>
            <div className="journal-entry-detail-fields">
              <label className="field" htmlFor={`${fieldId}-title`}>
                <span>
                  Title <span className="journal-optional">(optional)</span>
                </span>
                <input
                  id={`${fieldId}-title`}
                  maxLength={120}
                  {...register("title")}
                  aria-invalid={Boolean(errors.title)}
                />
                {errors.title && (
                  <span className="journal-field-error">
                    {errors.title.message}
                  </span>
                )}
              </label>
              <label className="field" htmlFor={`${fieldId}-collection`}>
                <span>
                  Collection{" "}
                  <span className="journal-optional">(optional)</span>
                </span>
                <input
                  id={`${fieldId}-collection`}
                  list={`${fieldId}-collections`}
                  placeholder="Choose or make a collection"
                  maxLength={40}
                  {...register("collection")}
                />
                {errors.collection && (
                  <span className="journal-field-error">
                    {errors.collection.message}
                  </span>
                )}
                <datalist id={`${fieldId}-collections`}>
                  {collections.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </label>
            </div>
          </details>
          <div className="journal-schedule-fields">
            <label className="journal-check-label">
              <input
                type="checkbox"
                checked={scheduled}
                onChange={(event) => {
                  setScheduled(event.target.checked);
                  if (!event.target.checked) setValue("revealLocal", "");
                }}
              />{" "}
              Open later
            </label>
            {scheduled && (
              <label className="field" htmlFor={`${fieldId}-reveal`}>
                Opening time
                <input
                  id={`${fieldId}-reveal`}
                  type="datetime-local"
                  {...register("revealLocal")}
                  aria-invalid={Boolean(errors.revealLocal)}
                  aria-describedby={`${fieldId}-reveal-help`}
                />
                <small id={`${fieldId}-reveal-help`}>
                  In your time zone: {me.timeZone.replaceAll("_", " ")}. Only
                  you can see the contents before this time.
                </small>
                {errors.revealLocal && (
                  <span className="journal-field-error" role="alert">
                    {errors.revealLocal.message}
                  </span>
                )}
                {scheduledPreview && <small>Opens {scheduledPreview}</small>}
              </label>
            )}
          </div>
          {(action.error || localError) && (
            <p className="form-error" role="alert">
              {action.error || localError}
            </p>
          )}
          <footer className="journal-compose-footer">
            <span className="muted">
              {draftAvailable ? "Draft saved in this tab." : ""}
              {draftAvailable && ["photo", "voice"].includes(kind)
                ? " Files aren’t kept in drafts."
                : ""}
            </span>
            <button
              className="button"
              type="submit"
              disabled={
                action.pending ||
                (kind === "photo" && upload.status === "uploading") ||
                (kind === "voice" && audioUpload.status === "uploading")
              }
            >
              {action.pending
                ? "Saving…"
                : scheduled
                  ? "Save for later"
                  : "Add to journal"}
            </button>
          </footer>
        </fieldset>
      </form>
    </JournalDialog>
  );
}
