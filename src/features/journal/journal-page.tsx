"use client";

import { useMemo, useState } from "react";
import { Pin, Plus, Search, X } from "lucide-react";
import { useSpace } from "@/components/space-provider";
import { EntryCard } from "./entry-card";
import { EntryComposer } from "./entry-composer";
import { PhotoPairs } from "./photo-pairs";
import { entrySummary, filterEntries } from "./journal-utils";
import "./journal.css";

export default function JournalPage() {
  const { data, isPending, error } = useSpace();
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState("");
  const [pinned, setPinned] = useState(false);
  const [composing, setComposing] = useState(false);
  const collections = useMemo(() => [...new Set(data?.entries.filter(entry => !entry.locked).map(entry => entry.collection).filter(Boolean) || [])].sort(), [data?.entries]);
  const entries = useMemo(() => filterEntries(data?.entries || [], { query, collection, pinned }), [data?.entries, query, collection, pinned]);
  const hasFilters = Boolean(query || collection || pinned);

  if (isPending) return <div className="journal-loading" role="status">Loading your journal…</div>;
  if (error || !data) return <div className="empty" role="alert"><h1>We couldn’t load your journal.</h1><p>{error?.message || "Please try again."}</p></div>;

  return <div className="journal-page">
    <header className="journal-page-heading"><h1>Journal</h1><button type="button" className="button" onClick={() => setComposing(true)}><Plus size={17} /> Add to journal</button></header>
    <div className="journal-toolbar">
      <label className="journal-search"><Search size={18} aria-hidden="true" /><span className="journal-visually-hidden">Search the journal</span><input type="search" placeholder="Find a note or memory" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <label className="journal-collection-select"><span className="journal-visually-hidden">Filter by collection</span><select value={collection} onChange={event => setCollection(event.target.value)}><option value="">All collections</option>{collections.map(name => <option key={name}>{name}</option>)}</select></label>
      <button className={`quiet journal-filter-button${pinned ? " is-selected" : ""}`} type="button" aria-pressed={pinned} onClick={() => setPinned(value => !value)}><Pin size={16} /> Pinned</button>
      {hasFilters && <button className="quiet journal-icon-button" type="button" aria-label="Clear filters" onClick={() => { setQuery(""); setCollection(""); setPinned(false); }}><X size={17} /></button>}
    </div>
    {!hasFilters && <PhotoPairs pairs={data.photoPairs} members={data.members} me={data.me} />}
    <div className="journal-layout">
      <div className="journal-feed">
        <p className="journal-result-count" aria-live="polite">{entries.length} {entries.length === 1 ? "entry" : "entries"}{hasFilters ? " found" : " in your journal"}</p>
        {entries.length ? entries.map(entry => <EntryCard key={entry.id} entry={entry} members={data.members} me={data.me} collections={collections} />) : <div className="journal-empty"><h2>{hasFilters ? "No matching entries" : "Your journal is empty"}</h2><p>{hasFilters ? "Try another word or clear the filters." : "Leave a note or add a photo to start your journal."}</p>{hasFilters ? <button className="secondary" type="button" onClick={() => { setQuery(""); setCollection(""); setPinned(false); }}>Clear filters</button> : <button className="secondary" type="button" onClick={() => setComposing(true)}>Add the first entry</button>}</div>}
      </div>
      <aside className="journal-sidebar" aria-label="Journal shortcuts">
        <section className="journal-side-section"><h2><Pin size={16} aria-hidden="true" /> Pinned</h2>{data.entries.some(entry => entry.pinned) ? <ul className="journal-pin-list">{data.entries.filter(entry => entry.pinned).slice(0, 5).map(entry => <li key={entry.id}><a href={`#entry-${entry.id}`} onClick={() => { setQuery(""); setCollection(""); setPinned(false); }}>{entrySummary(entry)}</a></li>)}</ul> : <p className="muted">Keep a favorite note close by.</p>}</section>
        {data.space.isDemo && <details className="journal-demo-credits"><summary>About these photos</summary><p>The demo uses illustrative photos by <a href="https://unsplash.com/photos/pasta-on-plate-with-fork-t8hTmte4O_g" target="_blank" rel="noopener noreferrer">Bruna Branco</a>, <a href="https://unsplash.com/photos/cloudy-sky-at-daytime-v9bnfMCyKbg" target="_blank" rel="noopener noreferrer">Billy Huynh</a>, <a href="https://unsplash.com/photos/coffee-in-cup-R5RtlMOYgX8" target="_blank" rel="noopener noreferrer">Olivia Anne Snyder</a>, and <a href="https://unsplash.com/photos/cloudy-sky-2W5LoumSdfw" target="_blank" rel="noopener noreferrer">Sebastien Gabriel</a> on Unsplash. Names and journal entries are fictional.</p></details>}
      </aside>
    </div>
    {composing && <EntryComposer me={data.me} spaceId={data.space.id} collections={collections} onClose={() => setComposing(false)} />}
  </div>;
}
