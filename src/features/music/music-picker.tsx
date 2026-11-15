"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Check, Link2, Music2, Search, X } from "lucide-react";
import { api, useAction } from "@/components/space-provider";
import {
  spotifyTrackId,
  type DailySong,
  type MusicSearch,
  type SpotifyTrack,
} from "@/shared/music";

export function MusicPicker({
  initial,
  day,
  searchAvailable,
  onClose,
}: {
  initial?: DailySong;
  day: string;
  searchAvailable: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const resolveRequest = useRef<AbortController | null>(null);
  const titleId = useId();
  const noteId = useId();
  const tabsId = useId();
  const searchTab = useRef<HTMLButtonElement>(null);
  const linkTab = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<"search" | "link">("search");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState<SpotifyTrack | null>(
    initial?.track || null,
  );
  const [note, setNote] = useState(initial?.note || "");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const action = useAction();
  const externalSearch = `https://open.spotify.com/search/${encodeURIComponent(query.trim())}`;
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog.current?.showModal();
    const element = dialog.current;
    return () => {
      resolveRequest.current?.abort();
      element?.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(query.trim()), 350);
    return () => window.clearTimeout(timeout);
  }, [query]);
  const search = useQuery({
    queryKey: ["spotify-search", debounced],
    queryFn: ({ signal }) =>
      api<MusicSearch>(`/api/music/search?q=${encodeURIComponent(debounced)}`, {
        signal,
      }),
    enabled:
      searchAvailable &&
      mode === "search" &&
      !selected &&
      debounced.length >= 2,
    staleTime: 60_000,
    retry: false,
  });
  const queryReady = query.trim() === debounced && debounced.length >= 2;
  async function resolve(event: FormEvent) {
    event.preventDefault();
    if (resolving) return;
    setResolveError(null);
    let shortLink = false;
    try {
      const parsed = new URL(url.trim());
      shortLink =
        parsed.protocol === "https:" &&
        parsed.hostname === "spotify.link" &&
        !parsed.port &&
        !parsed.username &&
        !parsed.password &&
        /^\/[A-Za-z0-9]+\/?$/.test(parsed.pathname);
    } catch {
      /* The full track parser also accepts Spotify track URIs. */
    }
    if (!spotifyTrackId(url) && !shortLink) {
      setResolveError(
        "Use a Spotify song link, such as open.spotify.com/track/…",
      );
      return;
    }
    const controller = new AbortController();
    resolveRequest.current?.abort();
    resolveRequest.current = controller;
    setResolving(true);
    try {
      const track = await api<SpotifyTrack>(
        `/api/music/resolve?url=${encodeURIComponent(url.trim())}`,
        { signal: controller.signal },
      );
      if (!controller.signal.aborted) setSelected(track);
    } catch (error) {
      if (!controller.signal.aborted)
        setResolveError(
          error instanceof Error
            ? error.message
            : "That song couldn’t load. Try its Spotify link again.",
        );
    } finally {
      if (!controller.signal.aborted) setResolving(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!selected || action.pending) return;
    try {
      await action.run(
        "/api/music/today",
        {
          trackId: selected.id,
          note: note.trim(),
          day,
          revision: initial?.revision ?? 0,
        },
        "PUT",
      );
      onClose();
    } catch {
      /* The selected track and note stay here for retry. */
    }
  }
  return (
    <dialog
      ref={dialog}
      className="music-picker"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!action.pending) onClose();
      }}
    >
      <header className="music-picker-heading">
        <h2 id={titleId}>{initial ? "Your daily pick" : "Choose a song"}</h2>
        <button
          className="quiet"
          type="button"
          aria-label="Close song picker"
          disabled={action.pending}
          onClick={onClose}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      {!selected ? (
        <>
          <div
            className="music-picker-tabs"
            role="tablist"
            aria-label="Find a song"
            onKeyDown={(event) => {
              if (
                resolving ||
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? "search"
                  : event.key === "End"
                    ? "link"
                    : mode === "search"
                      ? "link"
                      : "search";
              setMode(next);
              (next === "search" ? searchTab : linkTab).current?.focus();
            }}
          >
            <button
              type="button"
              role="tab"
              ref={searchTab}
              id={`${tabsId}-search-tab`}
              aria-controls={`${tabsId}-search-panel`}
              tabIndex={mode === "search" ? 0 : -1}
              aria-selected={mode === "search"}
              disabled={resolving}
              onClick={() => setMode("search")}
            >
              <Search size={16} aria-hidden="true" />
              Search
            </button>
            <button
              type="button"
              role="tab"
              ref={linkTab}
              id={`${tabsId}-link-tab`}
              aria-controls={`${tabsId}-link-panel`}
              tabIndex={mode === "link" ? 0 : -1}
              aria-selected={mode === "link"}
              disabled={resolving}
              onClick={() => setMode("link")}
            >
              <Link2 size={16} aria-hidden="true" />
              Song link
            </button>
          </div>
          <div
            className="music-search-panel"
            role="tabpanel"
            id={`${tabsId}-search-panel`}
            aria-labelledby={`${tabsId}-search-tab`}
            hidden={mode !== "search"}
          >
            <label className="field">
              Song or artist
              <input
                autoFocus
                type="search"
                value={query}
                maxLength={120}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Spotify"
                autoComplete="off"
              />
            </label>
            {searchAvailable ? (
              <>
                {query.trim().length < 2 && (
                  <p className="music-search-help">
                    Search by song title or artist.
                  </p>
                )}
                {query.trim().length >= 2 &&
                  (!queryReady || search.isFetching) && (
                    <p className="music-search-help" role="status">
                      Searching…
                    </p>
                  )}
                {queryReady && search.isError && (
                  <div className="music-search-error">
                    <p className="form-error" role="alert">
                      {search.error.message}
                    </p>
                    <a
                      href={externalSearch}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Find it on Spotify
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </a>
                    <p>Copy the song’s link, then use Song link.</p>
                  </div>
                )}
                {queryReady && search.data && !search.isFetching && (
                  <>
                    {search.data.tracks.length ? (
                      <ul
                        className="music-search-results"
                        aria-label="Spotify songs"
                      >
                        {search.data.tracks.map((track) => (
                          <li key={track.id}>
                            <button
                              type="button"
                              onClick={() => setSelected(track)}
                              aria-label={`Choose ${track.title}${track.artists.length ? ` by ${track.artists.join(", ")}` : ""}`}
                            >
                              {track.imageUrl ? (
                                <img
                                  src={track.imageUrl}
                                  alt=""
                                  width={48}
                                  height={48}
                                />
                              ) : (
                                <span className="music-art-fallback">
                                  <Music2 size={20} aria-hidden="true" />
                                </span>
                              )}
                              <span className="music-search-title">
                                <strong>{track.title}</strong>
                                <small>
                                  {track.artists.join(", ") || "Spotify song"}
                                </small>
                              </span>
                              <span className="music-result-choose">
                                Choose
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="music-search-help" role="status">
                        No songs found. Try another title or artist.
                      </p>
                    )}
                    <a
                      className="music-search-attribution"
                      href={externalSearch}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src="/spotify-logo.svg"
                        alt="Spotify"
                        width={70}
                        height={22}
                      />
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </a>
                  </>
                )}
              </>
            ) : (
              <div className="music-external-search">
                <p>Find a song on Spotify, copy its link, then add it here.</p>
                <a
                  className="secondary"
                  href={externalSearch}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img src="/spotify-logo.svg" alt="" width={70} height={21} />
                  Search on Spotify
                  <ArrowUpRight size={15} aria-hidden="true" />
                </a>
                <button
                  className="quiet"
                  type="button"
                  onClick={() => setMode("link")}
                >
                  I have a song link
                </button>
              </div>
            )}
          </div>
          <form
            className="music-link-panel"
            onSubmit={(event) => void resolve(event)}
            role="tabpanel"
            id={`${tabsId}-link-panel`}
            aria-labelledby={`${tabsId}-link-tab`}
            hidden={mode !== "link"}
          >
            <label className="field">
              Spotify song link
              <input
                type="text"
                inputMode="url"
                value={url}
                readOnly={resolving}
                onChange={(event) => {
                  setUrl(event.target.value);
                  setResolveError(null);
                }}
                placeholder="https://open.spotify.com/track/…"
                maxLength={2000}
                required
                autoComplete="off"
              />
            </label>
            <p className="music-search-help">
              In Spotify, choose Share → Copy song link.
            </p>
            {resolveError && (
              <p className="form-error" role="alert">
                {resolveError}
              </p>
            )}
            <button
              type="submit"
              className="secondary"
              disabled={resolving || !url.trim()}
            >
              {resolving ? "Loading song…" : "Find song"}
            </button>
          </form>
        </>
      ) : (
        <form
          className="music-save-form"
          onSubmit={(event) => void save(event)}
          aria-busy={action.pending}
        >
          <div className="music-selected-track">
            {selected.imageUrl ? (
              <img src={selected.imageUrl} alt="" width={72} height={72} />
            ) : (
              <span className="music-art-fallback">
                <Music2 size={28} aria-hidden="true" />
              </span>
            )}
            <div>
              <strong>{selected.title}</strong>
              {selected.artists.length > 0 && (
                <p>{selected.artists.join(", ")}</p>
              )}
              <a href={selected.url} target="_blank" rel="noopener noreferrer">
                <img
                  src="/spotify-logo.svg"
                  alt="Open in Spotify"
                  width={70}
                  height={21}
                />
              </a>
            </div>
          </div>
          <button
            className="quiet music-change-track"
            type="button"
            disabled={action.pending}
            onClick={() => {
              action.clearError();
              setSelected(null);
            }}
          >
            Choose a different song
          </button>
          <label className="field" htmlFor={noteId}>
            Your note
            <textarea
              id={noteId}
              value={note}
              readOnly={action.pending}
              onChange={(event) => setNote(event.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Why this one?"
            />
          </label>
          {action.error && (
            <p className="form-error" role="alert">
              {action.error}
            </p>
          )}
          <footer className="music-picker-footer">
            <button
              className="quiet"
              type="button"
              disabled={action.pending}
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="button" type="submit" disabled={action.pending}>
              <Check size={17} aria-hidden="true" />
              {action.pending ? "Saving…" : "Save today’s song"}
            </button>
          </footer>
        </form>
      )}
    </dialog>
  );
}
