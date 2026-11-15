"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  Music2,
  Pencil,
  Trash2,
} from "lucide-react";
import { useAction } from "@/components/space-provider";
import { SectionArt } from "@/components/section-art";
import { PersonAvatar } from "@/components/person-avatar";
import {
  spotifyEmbedUrl,
  type DailySong,
  type SpotifyTrack,
} from "@/shared/music";
import type { Person } from "@/shared/types";
import { songDate } from "./use-music";

export function SpotifyLink({ track }: { track: SpotifyTrack }) {
  return (
    <a
      className="music-spotify-link"
      href={track.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open in Spotify: ${track.title}`}
    >
      <img src="/spotify-logo.svg" alt="Spotify" width={70} height={21} />
      <span>Open in Spotify</span>
      <ArrowUpRight size={16} aria-hidden="true" />
    </a>
  );
}

export function SpotifyPlayer({ track }: { track: SpotifyTrack }) {
  return (
    <div className="music-player">
      <iframe
        key={track.id}
        src={spotifyEmbedUrl(track.id)}
        title={`Spotify player: ${track.title}`}
        width="100%"
        height="152"
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

export function SongCard({
  song,
  person,
  mine,
  history = false,
  onEdit,
}: {
  song: DailySong;
  person?: Person;
  mine: boolean;
  history?: boolean;
  onEdit?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [removeRevision, setRemoveRevision] = useState<number | null>(null);
  const action = useAction();
  const name = person?.name || "Member";
  async function remove() {
    if (action.pending || removeRevision === null) return;
    try {
      await action.run(
        `/api/music/${encodeURIComponent(song.id)}`,
        { revision: removeRevision },
        "DELETE",
      );
    } catch {
      /* Keep the confirmation and error available for retry. */
    }
  }
  return (
    <article
      className={`music-card${history ? " music-history-card" : ""}`}
      aria-label={`${name}’s song, ${songDate(song.day)}`}
    >
      <header className="music-card-heading">
        <div className="music-author">
          <PersonAvatar
            person={person}
            size={36}
            className="music-avatar"
          />
          <div>
            <h3>{mine ? "Your pick" : `${name}’s pick`}</h3>
            <p>
              <time dateTime={song.day}>{songDate(song.day)}</time>
              <span aria-hidden="true"> · </span>
              {song.timeZone.split("/").at(-1)?.replaceAll("_", " ")}
            </p>
          </div>
        </div>
        {mine && (
          <div className="music-card-actions">
            {onEdit && (
              <button
                className="quiet"
                aria-label="Edit your song"
                onClick={onEdit}
              >
                <Pencil size={16} aria-hidden="true" />
              </button>
            )}
            <button
              className="quiet"
              aria-label={`Remove ${song.track.title}`}
              aria-expanded={removeRevision !== null}
              onClick={() => {
                action.clearError();
                setRemoveRevision(
                  removeRevision === null ? song.revision : null,
                );
              }}
              disabled={action.pending}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </header>
      {history && (
        <button
          className="music-history-track"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Hide" : "Show"} player for ${song.track.title}`}
        >
          {song.track.imageUrl ? (
            <img
              src={song.track.imageUrl}
              alt=""
              width={56}
              height={56}
              loading="lazy"
            />
          ) : (
            <span className="music-art-fallback">
              <Music2 size={22} aria-hidden="true" />
            </span>
          )}
          <span>
            <strong>{song.track.title}</strong>
            {song.track.artists.length > 0 && (
              <small>{song.track.artists.join(", ")}</small>
            )}
          </span>
          <ChevronDown size={18} aria-hidden="true" />
        </button>
      )}
      {(!history || expanded) && (
        <SpotifyPlayer key={song.track.id} track={song.track} />
      )}
      {song.note && (
        <div className="music-note">
          <span className="music-note-label">
            {mine ? "Your note" : `From ${name}`}
          </span>
          <p>{song.note}</p>
        </div>
      )}
      <footer className="music-card-footer">
        <SpotifyLink track={song.track} />
      </footer>
      {removeRevision !== null && (
        <div className="music-remove-confirm">
          <p>Remove this song and its note from your space?</p>
          <div>
            <button
              className="secondary"
              disabled={action.pending}
              onClick={() => setRemoveRevision(null)}
            >
              Keep it
            </button>
            <button
              className="secondary danger"
              disabled={action.pending}
              onClick={() => void remove()}
            >
              {action.pending ? "Removing…" : "Remove song"}
            </button>
          </div>
          {action.error && (
            <p className="form-error" role="alert">
              {action.error}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

export function EmptySongCard({
  person,
  mine,
  onChoose,
}: {
  person: Person;
  mine: boolean;
  onChoose?: () => void;
}) {
  return (
    <article className="music-card music-empty-card">
      <div className="music-empty-symbol" aria-hidden="true">
        <SectionArt name="music" size={58} />
      </div>
      <h3>{mine ? "Your song for today" : `${person.name}’s song`}</h3>
      <p>{mine ? "Choose a song and leave a note." : "No pick yet today."}</p>
      {mine && (
        <button className="secondary" onClick={onChoose}>
          Choose a song
        </button>
      )}
    </article>
  );
}
