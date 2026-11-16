"use client";

import { useState } from "react";
import { Plus, Shuffle } from "lucide-react";
import { useAction } from "@/components/space-provider";
import { DRAWING_PROMPTS } from "@/shared/content";
import { DRAWING_HEIGHT, DRAWING_WIDTH, strokePath } from "@/shared/drawing";
import type { Drawing, SpaceSnapshot } from "@/shared/types";
import { SectionArt } from "@/components/section-art";
import { DrawingEditor } from "./drawing-editor";

export function DrawingsPanel({ space }: { space: SpaceSnapshot }) {
  const action = useAction();
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [promptIndex, setPromptIndex] = useState(0);
  const drawings = [...space.drawings].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const drawing = drawings.find((item) => item.id === selected) || drawings[0];
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    try {
      const created = await action.run<Drawing>("/api/drawings", {
        title: title.trim(),
      });
      setSelected(created.id);
      setCreating(false);
      setTitle("");
    } catch {
      /* Keep the title ready to retry. */
    }
  }
  return (
    <div className="drawings-panel">
      <div className="activity-section-intro">
        <div>
          <h2>Drawing relay</h2>
          <p className="muted">Take turns adding to the same canvas.</p>
        </div>
        <button
          className="secondary"
          onClick={() => setCreating(!creating)}
          aria-expanded={creating}
        >
          <Plus size={17} aria-hidden="true" />
          New drawing
        </button>
      </div>
      {creating && (
        <form className="panel activity-form" onSubmit={create}>
          <div className="activity-heading">
            <h3>Start a drawing</h3>
            <button
              className="quiet"
              type="button"
              onClick={() => setCreating(false)}
            >
              Cancel
            </button>
          </div>
          <label className="field">
            Give it a name
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={100}
              required
              placeholder="Whatever you feel like drawing"
            />
          </label>
          <div className="drawing-prompt-suggestion">
            <span className="muted">
              An idea: {DRAWING_PROMPTS[promptIndex % DRAWING_PROMPTS.length]}
            </span>
            <button
              className="quiet"
              type="button"
              onClick={() =>
                setTitle(DRAWING_PROMPTS[promptIndex % DRAWING_PROMPTS.length])
              }
            >
              Use this
            </button>
            <button
              className="quiet icon-button"
              type="button"
              aria-label="Another drawing idea"
              onClick={() => setPromptIndex(promptIndex + 1)}
            >
              <Shuffle size={16} />
            </button>
          </div>
          <button className="button" disabled={action.pending || !title.trim()}>
            {action.pending ? "Creating…" : "Open canvas"}
          </button>
        </form>
      )}
      {action.error && (
        <p className="form-error" role="alert">
          {action.error}
        </p>
      )}
      {drawing ? (
        <div className="drawings-layout">
          <div className="drawing-list" aria-label="Your drawings">
            {drawings.map((item) => (
              <button
                className={`drawing-thumbnail${drawing.id === item.id ? " selected" : ""}`}
                key={item.id}
                onClick={() => setSelected(item.id)}
                aria-pressed={drawing.id === item.id}
              >
                <svg
                  viewBox={`0 0 ${DRAWING_WIDTH} ${DRAWING_HEIGHT}`}
                  aria-hidden="true"
                >
                  {item.strokes.map((stroke) => (
                    <path
                      key={stroke.id}
                      d={strokePath(stroke)}
                      fill="none"
                      stroke={stroke.color}
                      strokeWidth={stroke.width + 2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                </svg>
                <span>{item.title}</span>
                <small>
                  {item.turnUserId === space.me.id
                    ? "Your turn"
                    : "Partner’s turn"}{" "}
                  · {item.strokes.length}{" "}
                  {item.strokes.length === 1 ? "stroke" : "strokes"}
                </small>
              </button>
            ))}
          </div>
          <DrawingEditor key={drawing.id} drawing={drawing} space={space} />
        </div>
      ) : (
        <div className="empty">
          <SectionArt name="drawing" size={72} />
          <h3>No drawings yet</h3>
          <p>
            Start from a blank canvas or pick an idea, then take turns adding
            strokes until it’s ready to save to your journal.
          </p>
          <button className="button" onClick={() => setCreating(true)}>
            Start a drawing
          </button>
        </div>
      )}
    </div>
  );
}
