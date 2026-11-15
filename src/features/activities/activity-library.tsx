"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  Check,
  Clock3,
  Search,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import { useAction } from "@/components/space-provider";
import type { Idea, SpaceSnapshot } from "@/shared/types";
import { SectionArt } from "@/components/section-art";
import { IdeaForm } from "./idea-form";

const icons = {
  Make: "drawing",
  Talk: "questions",
  Play: "activities",
  Discover: "plans",
  Everyday: "journal",
} as const;
type OpenTab = (tab: "questions" | "games" | "drawing") => void;

function IdeaCard({
  idea,
  meId,
  onOpen,
}: {
  idea: Idea;
  meId: string;
  onOpen: OpenTab;
}) {
  const action = useAction();
  const saved = idea.savedBy.includes(meId);
  const art = icons[idea.category as keyof typeof icons] || "journal";
  const target =
    idea.id === "drawing-relay"
      ? "drawing"
      : ["four-rounds", "three-clues"].includes(idea.id)
        ? "games"
        : null;
  const planParams = new URLSearchParams({
    title: idea.title,
    duration: String(idea.duration),
    kind: "date",
  });
  if (idea.link) planParams.set("link", idea.link);
  return (
    <article className={`idea-card${idea.done ? " idea-done" : ""}`}>
      <div className="idea-card-top">
        <span className={`idea-icon idea-${idea.category.toLowerCase()}`}>
          <SectionArt name={art} size={48} />
        </span>
        <button
          type="button"
          className={`quiet icon-button${saved ? " is-saved" : ""}`}
          disabled={action.pending}
          aria-label={`${saved ? "Unsave" : "Save"} ${idea.title}`}
          aria-pressed={saved}
          onClick={() =>
            void action
              .run(`/api/ideas/${idea.id}`, { saved: !saved }, "PATCH")
              .catch(() => {})
          }
        >
          <Bookmark size={19} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <span className="activity-eyebrow">{idea.category}</span>
      <h3>{idea.title}</h3>
      <p>{idea.description}</p>
      <div className="idea-meta">
        <span>
          <Clock3 size={14} aria-hidden="true" />
          {idea.duration} min
        </span>
        <span>
          {idea.mode === "live" ? "Together now" : "At your own pace"}
        </span>
      </div>
      <details className="idea-materials">
        <summary>What you need</summary>
        <p>{idea.materials || "Just an idea and a little time."}</p>
        {idea.link && (
          <a href={idea.link} target="_blank" rel="noopener noreferrer">
            Open activity link <ArrowUpRight size={13} aria-hidden="true" />
          </a>
        )}
      </details>
      <div className="idea-actions">
        {target ? (
          <button className="secondary" onClick={() => onOpen(target)}>
            Start here
          </button>
        ) : (
          <Link className="secondary" href={`/plans?${planParams}`}>
            Make a plan
          </Link>
        )}
        <button
          className="quiet"
          disabled={action.pending}
          aria-pressed={idea.done}
          onClick={() =>
            void action
              .run(`/api/ideas/${idea.id}`, { done: !idea.done }, "PATCH")
              .catch(() => {})
          }
        >
          {idea.done && <Check size={15} aria-hidden="true" />}
          {idea.done ? "Tried it" : "Mark tried"}
        </button>
      </div>
      {target && (
        <Link className="idea-plan-link" href={`/plans?${planParams}`}>
          Plan it for later
        </Link>
      )}
      {action.error && (
        <p className="form-error" role="alert">
          {action.error}
        </p>
      )}
    </article>
  );
}

export function ActivityLibrary({
  space,
  onOpen,
}: {
  space: SpaceSnapshot;
  onOpen: OpenTab;
}) {
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("all");
  const [category, setCategory] = useState("all");
  const [savedOnly, setSavedOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const filtered = useMemo(
    () =>
      space.ideas.filter((idea) => {
        const text =
          `${idea.title} ${idea.description} ${idea.materials}`.toLowerCase();
        return (
          text.includes(search.trim().toLowerCase()) &&
          (mode === "all" || idea.mode === mode) &&
          (category === "all" || idea.category === category) &&
          (!savedOnly || idea.savedBy.length > 0)
        );
      }),
    [space.ideas, search, mode, category, savedOnly],
  );
  return (
    <div className="activity-library">
      <div className="activity-section-intro">
        <div>
          <h2>Choose an activity</h2>
        </div>
        <button
          className="secondary"
          onClick={() => setShowForm(!showForm)}
          aria-expanded={showForm}
        >
          <Plus size={17} aria-hidden="true" />
          Add an idea
        </button>
      </div>
      {showForm && <IdeaForm onClose={() => setShowForm(false)} />}
      <div className="activity-filters">
        <label className="activity-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search activity ideas</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search ideas"
          />
        </label>
        <label className="field compact">
          <span className="sr-only">Filter by timing</span>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value)}
          >
            <option value="all">Any timing</option>
            <option value="live">Together now</option>
            <option value="anytime">At your own pace</option>
          </select>
        </label>
        <label className="field compact">
          <span className="sr-only">Filter by category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="all">All activities</option>
            {Object.keys(icons).map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <button
          className={`secondary saved-filter${savedOnly ? " selected" : ""}`}
          aria-pressed={savedOnly}
          onClick={() => setSavedOnly(!savedOnly)}
        >
          <Bookmark size={16} aria-hidden="true" />
          Saved by either of us
        </button>
      </div>
      <p className="activity-result-count muted" aria-live="polite">
        {filtered.length} {filtered.length === 1 ? "idea" : "ideas"}
        {savedOnly ? " saved" : " to choose from"}
      </p>
      {filtered.length ? (
        <div className="idea-grid">
          {filtered.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              meId={space.me.id}
              onOpen={onOpen}
            />
          ))}
        </div>
      ) : (
        <div className="empty">
          <SectionArt name="journal" size={72} />
          <h3>
            {savedOnly
              ? "Nothing saved here yet"
              : "No ideas match those filters"}
          </h3>
          <p>
            {savedOnly
              ? "Use the bookmark on any idea to keep it for later."
              : "Try a shorter search or another category."}
          </p>
          <button
            className="secondary"
            onClick={() => {
              setSearch("");
              setMode("all");
              setCategory("all");
              setSavedOnly(false);
            }}
          >
            Show all ideas
          </button>
        </div>
      )}
    </div>
  );
}
