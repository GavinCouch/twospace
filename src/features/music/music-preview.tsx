"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SectionArt } from "@/components/section-art";
import type { SpaceSnapshot } from "@/shared/types";
import { localDateInZone } from "@/shared/time";
import { useMusic, useMusicNow } from "./use-music";
import "./music.css";

export function MusicPreview({ space }: { space: SpaceSnapshot }) {
  const music = useMusic(space);
  const now = useMusicNow();
  const songs =
    music.data?.songs.filter((song) => {
      const member = space.members.find(
        (person) => person.id === song.authorId,
      );
      return member && song.day === localDateInZone(now, member.timeZone);
    }) || [];
  return (
    <section className="journal-music-preview">
      <div className="sidebar-card-label">
        <SectionArt name="music" size={30} />
        <span>Today’s songs</span>
      </div>
      {songs.length ? (
        <>
          <ul>
            {songs.map((song) => (
              <li key={song.id}>
                <a
                  href={song.track.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {song.track.imageUrl && (
                    <img
                      src={song.track.imageUrl}
                      alt=""
                      width={44}
                      height={44}
                      loading="lazy"
                    />
                  )}
                  <span>
                    <strong>{song.track.title}</strong>
                    <small>
                      {space.members.find(
                        (person) => person.id === song.authorId,
                      )?.name || "Member"}
                    </small>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <a
            className="music-preview-attribution"
            href="https://open.spotify.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img src="/spotify-logo.svg" alt="Spotify" width={70} height={21} />
          </a>
        </>
      ) : (
        <p>Pick a song for each other.</p>
      )}
      <Link className="sidebar-card-link" href="/music">
        {songs.length ? "Listen and read notes" : "Choose a song"}
        <ArrowUpRight size={17} aria-hidden="true" />
      </Link>
    </section>
  );
}
