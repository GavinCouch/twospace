"use client";

import { useState } from "react";
import { Clock3, ExternalLink, LockKeyhole, Pin } from "lucide-react";
import type { Entry, Person } from "@/shared/types";
import { PersonAvatar } from "@/components/person-avatar";
import { formatInZone } from "@/shared/time";
import { JournalDialog } from "./journal-dialog";
import { EntryOptions } from "./entry-options";
import { EntryConversation } from "./entry-conversation";
import { SavedDrawing } from "./saved-drawing";
import {
  entryDate,
  entryKindLabels,
  linkLabel,
  safeExternalUrl,
} from "./journal-utils";

export function EntryCard({
  entry,
  members,
  me,
  collections = [],
  timeOnly = false,
  arriving = false,
}: {
  entry: Entry;
  members: Person[];
  me: Person;
  collections?: string[];
  timeOnly?: boolean;
  arriving?: boolean;
}) {
  const author = members.find((person) => person.id === entry.authorId);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [photoAttempt, setPhotoAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const link = entry.url && safeExternalUrl(entry.url);
  const scheduled = entry.revealAt && Date.parse(entry.revealAt) > Date.now();
  const description = entry.body || entry.title || "A shared photo";
  const longBody = entry.body.length > 420;

  return (
    <article
      className={`journal-entry journal-entry-${entry.kind}${entry.locked ? " is-locked" : ""}${arriving ? " is-arriving" : ""}`}
      id={`entry-${entry.id}`}
    >
      <header className="journal-entry-heading">
        <PersonAvatar person={author} size={34} />
        <div className="journal-byline">
          <strong>{author?.name || "Member"}</strong>
          <span>
            <time dateTime={entry.createdAt}>
              {timeOnly
                ? new Intl.DateTimeFormat("en", {
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: me.timeZone,
                  }).format(new Date(entry.createdAt))
                : entryDate(entry.createdAt, me.timeZone)}
            </time>
            <span aria-hidden="true"> · </span>
            {entryKindLabels[entry.kind]}
          </span>
        </div>
        {entry.pinned && (
          <Pin size={16} className="journal-pin-mark" aria-label="Pinned" />
        )}
        {!entry.locked && (
          <EntryOptions entry={entry} meId={me.id} collections={collections} />
        )}
      </header>
      {entry.locked ? (
        <div className="journal-locked-note">
          <LockKeyhole size={23} strokeWidth={1.5} aria-hidden="true" />
          <h3>A note for later</h3>
          <p>
            Opens{" "}
            {entry.revealAt
              ? formatInZone(entry.revealAt, me.timeZone)
              : "later"}
            .
          </p>
        </div>
      ) : (
        <>
          {scheduled && (
            <p className="journal-scheduled">
              <Clock3 size={15} aria-hidden="true" /> Only you can see this
              until {formatInZone(entry.revealAt!, me.timeZone)}.
            </p>
          )}
          {entry.title && entry.kind !== "photo" && (
            <h3 className="journal-entry-title">{entry.title}</h3>
          )}
          {entry.kind === "photo" && entry.mediaId && (
            <>
              {photoFailed ? (
                <div className="journal-media-error">
                  <p>The photo didn’t load.</p>
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => {
                      setPhotoFailed(false);
                      setPhotoAttempt((value) => value + 1);
                    }}
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="journal-photo-button"
                  onClick={() => setPhotoOpen(true)}
                  aria-label="View full photo"
                >
                  <img
                    key={photoAttempt}
                    src={`/api/media/${entry.mediaId}`}
                    alt={description.slice(0, 300)}
                    loading="lazy"
                    onError={() => setPhotoFailed(true)}
                  />
                </button>
              )}
            </>
          )}
          {entry.kind === "photo" && entry.title && (
            <h3 className="journal-entry-title photo-entry-title">
              {entry.title}
            </h3>
          )}
          {entry.kind === "drawing" && entry.drawing && (
            <SavedDrawing strokes={entry.drawing} caption={description} />
          )}
          {entry.kind === "voice" && entry.mediaId && (
            <div className="journal-voice-playback">
              <audio
                controls
                preload="none"
                src={`/api/media/${entry.mediaId}`}
                aria-label={
                  entry.title ||
                  `Voice note from ${author?.name || "your partner"}`
                }
              />
            </div>
          )}
          {entry.body && (
            <p className="journal-entry-body">
              {longBody && !expanded
                ? `${entry.body.slice(0, 420).trimEnd()}…`
                : entry.body}
            </p>
          )}
          {longBody && (
            <button
              type="button"
              className="quiet journal-read-more"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? "Show less" : "Read full entry"}
            </button>
          )}
          {link && (
            <a
              className="journal-link-preview"
              href={link}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>
                <span className="journal-link-host">{linkLabel(link)}</span>
                <span>{entry.title || "Open saved link"}</span>
              </span>
              <ExternalLink size={19} aria-hidden="true" />
              <span className="journal-visually-hidden">
                {" "}
                (opens in a new tab)
              </span>
            </a>
          )}
          {entry.collection && (
            <span className="journal-collection-label">{entry.collection}</span>
          )}
          <EntryConversation entry={entry} members={members} me={me} />
        </>
      )}
      {photoOpen && (
        <JournalDialog
          title={entry.title || "Photo"}
          wide
          onClose={() => setPhotoOpen(false)}
        >
          <img
            className="journal-full-photo"
            src={`/api/media/${entry.mediaId}`}
            alt={description.slice(0, 300)}
          />
          <p className="journal-photo-caption">{entry.body}</p>
        </JournalDialog>
      )}
    </article>
  );
}
