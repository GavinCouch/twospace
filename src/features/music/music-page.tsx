"use client";

import { useState } from "react";
import { Music2, Plus } from "lucide-react";
import { useSpace } from "@/components/space-provider";
import type { DailySong, MusicSnapshot } from "@/shared/music";
import type { SpaceSnapshot } from "@/shared/types";
import { localDateInZone } from "@/shared/time";
import { EmptySongCard, SongCard } from "./music-card";
import { MusicPicker } from "./music-picker";
import { useMusic, useMusicNow } from "./use-music";
import "./music.css";

export default function MusicPage() {
  const { data: space } = useSpace();
  const music = useMusic(space);
  if (!space) return null;
  if (music.isError && !music.data)
    return (
      <div className="music-page">
        <h1>Music</h1>
        <p className="form-error" role="alert">
          Your songs couldn’t load.
        </p>
        <button className="secondary" onClick={() => void music.refetch()}>
          Try again
        </button>
      </div>
    );
  if (!music.data)
    return (
      <div className="music-page">
        <h1>Music</h1>
        <p className="muted" role="status">
          Loading your songs…
        </p>
      </div>
    );
  return (
    <MusicContent
      key={`${space.space.id}:${space.me.id}`}
      space={space}
      data={music.data}
    />
  );
}

export function MusicContent({
  space,
  data,
}: {
  space: SpaceSnapshot;
  data: MusicSnapshot;
}) {
  const now = useMusicNow();
  const [picker, setPicker] = useState<{
    initial?: DailySong;
    day: string;
  } | null>(null);
  const [historyLimit, setHistoryLimit] = useState(12);
  const today = space.members.map((person) => ({
    person,
    song: data.songs.find(
      (song) =>
        song.authorId === person.id &&
        song.day === localDateInZone(now, person.timeZone),
    ),
  }));
  const mine = today.find((item) => item.person.id === space.me.id)?.song;
  const todayIds = new Set(today.map((item) => item.song?.id));
  const history = data.songs.filter((song) => !todayIds.has(song.id));
  const choose = () => setPicker({ initial: mine, day: data.today });
  return (
    <div className="music-page">
      <header className="page-title music-page-heading">
        <h1>Music</h1>
        <button className="button" onClick={choose}>
          <Plus size={17} aria-hidden="true" />
          {mine ? "Change your pick" : "Pick today’s song"}
        </button>
      </header>
      <section className="music-today" aria-labelledby="music-today-heading">
        <div className="music-section-heading">
          <h2 id="music-today-heading">Today’s songs</h2>
          <span>One each, in your own time zone.</span>
        </div>
        <div className="music-today-grid">
          {today.map(({ person, song }) =>
            song ? (
              <SongCard
                key={person.id}
                song={song}
                person={person}
                mine={person.id === space.me.id}
                onEdit={person.id === space.me.id ? choose : undefined}
              />
            ) : (
              <EmptySongCard
                key={person.id}
                person={person}
                mine={person.id === space.me.id}
                onChoose={choose}
              />
            ),
          )}
        </div>
      </section>
      <section
        className="music-history"
        aria-labelledby="music-history-heading"
      >
        <div className="music-section-heading">
          <h2 id="music-history-heading">Past picks</h2>
          {history.length > 0 && (
            <span>
              {history.length} {history.length === 1 ? "song" : "songs"}
            </span>
          )}
        </div>
        {history.length ? (
          <>
            <div className="music-history-grid">
              {history.slice(0, historyLimit).map((song) => (
                <SongCard
                  key={song.id}
                  song={song}
                  person={space.members.find(
                    (member) => member.id === song.authorId,
                  )}
                  mine={song.authorId === space.me.id}
                  history
                />
              ))}
            </div>
            {history.length > historyLimit && (
              <button
                className="secondary music-show-more"
                onClick={() => setHistoryLimit((limit) => limit + 12)}
              >
                Show older songs
              </button>
            )}
          </>
        ) : (
          <div className="music-history-empty">
            <Music2 size={20} aria-hidden="true" />
            <p>Your past picks and notes will stay here.</p>
          </div>
        )}
      </section>
      {picker && (
        <MusicPicker
          key={`${picker.initial?.id || "new"}:${picker.day}`}
          initial={picker.initial}
          day={picker.day}
          searchAvailable={data.searchAvailable}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
