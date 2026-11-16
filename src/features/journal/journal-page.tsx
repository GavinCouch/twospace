"use client";
import { SectionArt } from "@/components/section-art";

import { useMemo, useRef, useState } from "react";
import { Pin, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { useSpace } from "@/components/space-provider";
import { EntryCard } from "./entry-card";
import { EntryComposer } from "./entry-composer";
import { PhotoPairs } from "./photo-pairs";
import { filterEntries, groupJournalDays } from "./journal-utils";
import { useEntryArrivals } from "./use-entry-arrivals";
import { useRevealClock } from "./use-reveal-clock";
import "./journal.css";

const views = [
  { id: "entries", label: "Entries" },
  { id: "photos", label: "Photo pairs" },
] as const;
type View = (typeof views)[number]["id"];

export default function JournalPage() {
  const { data, isPending, error, refetch } = useSpace();
  const [view, setView] = useState<View>("entries");
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState("");
  const [pinned, setPinned] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const viewButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const arrivingEntries = useEntryArrivals(
    data?.entries,
    `${data?.space.id}:${data?.me.id}`,
  );
  const revealClock = useRevealClock(data?.entries);
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
      (entry.revealAt && Date.parse(entry.revealAt) > revealClock),
  );
  const laterIds = new Set(forLater.map((entry) => entry.id));
  const days = groupJournalDays(
    entries.filter((entry) => !laterIds.has(entry.id)),
    data?.me.timeZone || "UTC",
  );

  function clearFilters() {
    setQuery("");
    setCollection("");
    setPinned(false);
  }

  if (isPending)
    return (
      <div className="journal-loading" role="status">
        Loading your journal…
      </div>
    );
  if (error || !data)
    return (
      <div className="journal-empty" role="alert">
        <h1>We couldn’t load your journal.</h1>
        <p>{error?.message || "Please try again."}</p>
        <button className="secondary" onClick={() => void refetch()}>
          Try again
        </button>
      </div>
    );

  return (
    <div className="journal-page">
      <header className="journal-page-heading">
        <h1>Journal</h1>
        <button
          type="button"
          className="button"
          onClick={() => setComposing(true)}
        >
          <Plus size={17} aria-hidden="true" /> New entry
        </button>
      </header>
      <div className="journal-navigation">
        <div
          className="journal-view-tabs"
          role="tablist"
          aria-label="Journal views"
        >
          {views.map(({ id, label }, index) => (
            <button
              key={id}
              ref={(element) => {
                viewButtons.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`journal-tab-${id}`}
              aria-controls={`journal-panel-${id}`}
              aria-selected={view === id}
              tabIndex={view === id ? 0 : -1}
              onClick={() => setView(id)}
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? views.length - 1
                      : (index + 1) % views.length;
                setView(views[next].id);
                viewButtons.current[next]?.focus();
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {view === "entries" && (
          <button
            type="button"
            className={`quiet journal-filter-toggle${hasFilters ? " has-filters" : ""}`}
            aria-expanded={filtersOpen}
            aria-controls="journal-filters"
            onClick={() => setFiltersOpen((value) => !value)}
          >
            <SlidersHorizontal size={16} aria-hidden="true" /> Filter
            {hasFilters && (
              <span
                className="journal-filter-dot"
                aria-label="Filters active"
              />
            )}
          </button>
        )}
      </div>
      <div
        role="tabpanel"
        id={`journal-panel-${view}`}
        aria-labelledby={`journal-tab-${view}`}
        tabIndex={0}
        className="journal-view-panel"
      >
        {view === "photos" ? (
          <PhotoPairs
            key={`${data.space.id}-${data.me.id}`}
            pairs={data.photoPairs}
            members={data.members}
            me={data.me}
          />
        ) : (
          <>
            {filtersOpen && (
              <div className="journal-toolbar" id="journal-filters">
                <label className="journal-search">
                  <Search size={17} aria-hidden="true" />
                  <span className="journal-visually-hidden">
                    Search the journal
                  </span>
                  <input
                    type="search"
                    placeholder="Search entries"
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
                  <Pin size={15} aria-hidden="true" /> Pinned
                </button>
                {hasFilters && (
                  <button
                    className="quiet journal-icon-button"
                    type="button"
                    aria-label="Clear filters"
                    onClick={clearFilters}
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
            {!entries.length && (
              <div className="journal-empty">
                {!hasFilters && <SectionArt name="journal" size={84} />}
                <h2>{hasFilters ? "No matching entries" : "No entries yet"}</h2>
                <p>
                  {hasFilters
                    ? "Try another search or clear your filters."
                    : "Add a note, photo, link, or voice message for your partner."}
                </p>
                {hasFilters ? (
                  <button
                    className="secondary"
                    type="button"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </button>
                ) : (
                  <button
                    className="button"
                    type="button"
                    onClick={() => setComposing(true)}
                  >
                    Write a note
                  </button>
                )}
              </div>
            )}
            <div className="journal-feed">
              {days.map((day) => (
                <section
                  className="journal-day"
                  key={day.key}
                  aria-labelledby={`journal-day-${day.key}`}
                >
                  <h2
                    className="journal-day-heading"
                    id={`journal-day-${day.key}`}
                  >
                    <time dateTime={day.key}>{day.label}</time>{" "}
                    <span>{day.weekday}</span>
                  </h2>
                  <div className="journal-day-entries">
                    {day.entries.map((entry) => (
                      <EntryCard
                        key={`${data.me.id}-${entry.id}`}
                        entry={entry}
                        members={data.members}
                        me={data.me}
                        collections={collections}
                        timeOnly
                        arriving={arrivingEntries.has(entry.id)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
            {forLater.length > 0 && (
              <details className="journal-later" open={hasFilters || undefined}>
                <summary>
                  For later <span>{forLater.length}</span>
                </summary>
                <div className="journal-later-entries">
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
          </>
        )}
      </div>
      {composing && (
        <EntryComposer
          key={`${data.space.id}-${data.me.id}`}
          me={data.me}
          spaceId={data.space.id}
          collections={collections}
          onClose={() => setComposing(false)}
          onSaved={() => {
            setView("entries");
            clearFilters();
          }}
        />
      )}
    </div>
  );
}
