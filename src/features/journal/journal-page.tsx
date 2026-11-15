"use client";
import { SectionArt } from "@/components/section-art";

import { useMemo, useState } from "react";
import { Pin, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { useSpace } from "@/components/space-provider";
import { EntryCard } from "./entry-card";
import { EntryComposer } from "./entry-composer";
import { JournalSidebar } from "./journal-sidebar";
import { filterEntries } from "./journal-utils";
import { useEntryArrivals } from "./use-entry-arrivals";
import "./journal.css";

export default function JournalPage() {
  const { data, isPending, error } = useSpace();
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState("");
  const [pinned, setPinned] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const arrivingEntries = useEntryArrivals(data?.entries, `${data?.space.id}:${data?.me.id}`);
  const collections = useMemo(
    () =>
      [
        ...new Set(
          data?.entries
            .filter((entry) => !entry.locked)
            .map((entry) => entry.collection)
            .filter(Boolean) || [],
        ),
      ].sort(),
    [data?.entries],
  );
  const entries = useMemo(
    () => filterEntries(data?.entries || [], { query, collection, pinned }),
    [data?.entries, query, collection, pinned],
  );
  const hasFilters = Boolean(query || collection || pinned);
  const forLater = entries.filter(
    (entry) =>
      entry.locked ||
      (entry.revealAt && Date.parse(entry.revealAt) > Date.now()),
  );
  const visible = entries.filter(
    (entry) => !forLater.some((later) => later.id === entry.id),
  );
  const featured = visible.find(
    (entry) => entry.kind === "photo" && entry.mediaId,
  );
  const leadNotes = featured
    ? visible.filter((entry) => entry.kind === "note").slice(0, 2)
    : [];
  const otherEntries = visible.filter(
    (entry) =>
      entry.id !== featured?.id &&
      !leadNotes.some((note) => note.id === entry.id),
  );

  if (isPending)
    return (
      <div className="journal-loading" role="status">
        Loading your journal…
      </div>
    );
  if (error || !data)
    return (
      <div className="empty" role="alert">
        <h1>We couldn’t load your journal.</h1>
        <p>{error?.message || "Please try again."}</p>
      </div>
    );

  return (
    <div className="journal-page">
      <header className="journal-page-heading">
        <h1>Journal</h1>
        <div className="journal-heading-actions">
          <button
            type="button"
            className={`quiet journal-filter-toggle${hasFilters ? " has-filters" : ""}`}
            aria-label="Filter journal"
            aria-expanded={filtersOpen}
            aria-controls="journal-filters"
            onClick={() => setFiltersOpen((value) => !value)}
          >
            <SlidersHorizontal size={19} />
          </button>
          <button
            type="button"
            className="button"
            onClick={() => setComposing(true)}
          >
            <Plus size={17} /> Add to journal
          </button>
        </div>
      </header>
      {filtersOpen && (
        <div className="journal-toolbar" id="journal-filters">
          <label className="journal-search">
            <Search size={18} aria-hidden="true" />
            <span className="journal-visually-hidden">Search the journal</span>
            <input
              type="search"
              placeholder="Find a note or memory"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="journal-collection-select">
            <span className="journal-visually-hidden">
              Filter by collection
            </span>
            <select
              value={collection}
              onChange={(event) => setCollection(event.target.value)}
            >
              <option value="">All collections</option>
              {collections.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <button
            className={`quiet journal-filter-button${pinned ? " is-selected" : ""}`}
            type="button"
            aria-pressed={pinned}
            onClick={() => setPinned((value) => !value)}
          >
            <Pin size={16} /> Pinned
          </button>
          {hasFilters && (
            <button
              className="quiet journal-icon-button"
              type="button"
              aria-label="Clear filters"
              onClick={() => {
                setQuery("");
                setCollection("");
                setPinned(false);
              }}
            >
              <X size={17} />
            </button>
          )}
        </div>
      )}
      <p className="journal-visually-hidden" role="status">
        {entries.length} {entries.length === 1 ? "entry" : "entries"}
        {hasFilters ? " found" : " in your journal"}
      </p>
      <div className={`journal-layout${hasFilters ? " is-filtered" : ""}`}>
        <div className="journal-feed">
          {featured && (
            <div
              className={`journal-opening${leadNotes.length ? "" : " without-notes"}`}
            >
              <div className="journal-featured">
                <EntryCard
                  key={`${data.me.id}-${featured.id}`}
                  entry={featured}
                  members={data.members}
                  me={data.me}
                  collections={collections}
                  featured
                  arriving={arrivingEntries.has(featured.id)}
                />
              </div>
              {leadNotes.length > 0 && (
                <div className="journal-notes-stack">
                  {leadNotes.map((entry) => (
                    <EntryCard
                      key={`${data.me.id}-${entry.id}`}
                      entry={entry}
                      members={data.members}
                      me={data.me}
                      collections={collections}
                      arriving={arrivingEntries.has(entry.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          {!entries.length && (
            <div className="journal-empty">
              <SectionArt name="journal" size={88} />
              <h2>
                {hasFilters ? "No matching entries" : "Your journal is empty"}
              </h2>
              <p>
                {hasFilters
                  ? "Try another word or clear the filters."
                  : "Leave a note or add a photo to start your journal."}
              </p>
              {hasFilters ? (
                <button
                  className="secondary"
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setCollection("");
                    setPinned(false);
                  }}
                >
                  Clear filters
                </button>
              ) : (
                <button
                  className="secondary"
                  type="button"
                  onClick={() => setComposing(true)}
                >
                  Add the first entry
                </button>
              )}
            </div>
          )}
          {otherEntries.length > 0 && (
            <div className="journal-entry-grid">
              {otherEntries.map((entry) => (
                <EntryCard
                  key={`${data.me.id}-${entry.id}`}
                  entry={entry}
                  members={data.members}
                  me={data.me}
                  collections={collections}
                  arriving={arrivingEntries.has(entry.id)}
                />
              ))}
            </div>
          )}
          {forLater.length > 0 && (
            <details className="journal-later" open={hasFilters || undefined}>
              <summary>
                For later <span>{forLater.length}</span>
              </summary>
              <div className="journal-entry-grid">
                {forLater.map((entry) => (
                  <EntryCard
                    key={`${data.me.id}-${entry.id}`}
                    entry={entry}
                    members={data.members}
                    me={data.me}
                    collections={collections}
                    arriving={arrivingEntries.has(entry.id)}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
        {!hasFilters && <JournalSidebar space={data} />}
      </div>
      {composing && (
        <EntryComposer
          key={`${data.space.id}-${data.me.id}`}
          me={data.me}
          spaceId={data.space.id}
          collections={collections}
          onClose={() => setComposing(false)}
        />
      )}
    </div>
  );
}
