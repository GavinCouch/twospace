"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Undo2, Bookmark, Check } from "lucide-react";
import { useAction, useSpace } from "@/components/space-provider";
import type { Drawing, SpaceSnapshot } from "@/shared/types";
import { DrawingSurface, type NewStroke } from "./drawing-surface";

export function DrawingEditor({ drawing, space }: { drawing: Drawing; space: SpaceSnapshot }) {
  const action = useAction();
  const query = useSpace();
  const [caption, setCaption] = useState(drawing.caption);
  const [dirty, setDirty] = useState(false);
  const [pendingStroke, setPendingStroke] = useState<NewStroke | null>(null);
  const [notice, setNotice] = useState("");
  const mine = drawing.turnUserId === space.me.id;
  const turnName = space.members.find(member => member.id === drawing.turnUserId)?.name || "Your partner";
  const canUndo = mine && drawing.strokes.at(-1)?.authorId === space.me.id;
  useEffect(() => { if (!dirty) setCaption(drawing.caption); }, [drawing.caption, dirty]);
  async function edit(body: Record<string, unknown>) {
    setNotice("");
    try { await action.run(`/api/drawings/${drawing.id}`, { revision: drawing.revision, ...body }, "PATCH"); return true; }
    catch { await query.refetch(); return false; }
  }
  async function saveStroke(stroke: NewStroke) {
    setPendingStroke(stroke);
    if (await edit({ action: "stroke", stroke })) setPendingStroke(null);
  }
  async function saveCaption(event: React.FormEvent) {
    event.preventDefault();
    if (await edit({ action: "caption", caption: caption.trim() })) { setDirty(false); setNotice("Caption saved."); }
  }
  async function saveMemory() {
    if (await edit({ action: "save" })) setNotice("Saved to your journal. Save again after more drawing to update that memory.");
  }
  return <article className="panel drawing-editor">
    <div className="activity-heading"><div><h3>{drawing.title}</h3><p className="drawing-turn" role="status">{mine ? "Your turn to add something." : `${turnName} is drawing. You can pick this up when they pass it over.`}</p></div><span className="muted small-copy">{drawing.strokes.length} / 300 marks</span></div>
    <DrawingSurface strokes={drawing.strokes} caption={drawing.caption} disabled={!mine || action.pending || !!pendingStroke || drawing.strokes.length >= 300} pendingStroke={pendingStroke} onStroke={stroke => void saveStroke(stroke)} />
    {pendingStroke && !action.pending && <div className="stroke-retry"><p>This mark has not been saved.</p><button className="secondary" onClick={() => void saveStroke(pendingStroke)} disabled={!mine}>Retry mark</button><button className="quiet" onClick={() => { setPendingStroke(null); action.clearError(); }}>Discard mark</button></div>}
    <div className="drawing-actions"><button className="secondary" disabled={!canUndo || action.pending || !!pendingStroke} onClick={() => void edit({ action: "undo" })}><Undo2 size={17} aria-hidden="true" />Undo my last mark</button><button className="button" disabled={!mine || action.pending || !!pendingStroke || space.members.length < 2} onClick={() => void edit({ action: "pass" })}>Pass to {space.members.find(member => member.id !== space.me.id)?.name || "your partner"}<ArrowRight size={17} aria-hidden="true" /></button></div>
    <form className="drawing-caption-form" onSubmit={saveCaption}><label className="field">Caption<textarea value={caption} onChange={event => { setCaption(event.target.value); setDirty(true); }} maxLength={1000} rows={2} placeholder="Describe the drawing or leave a note about it." /></label><div className="activity-heading"><p className="muted small-copy">A caption also makes the drawing easier to understand without seeing it.</p><button className="secondary" disabled={!dirty || action.pending || !!pendingStroke}>Save caption</button></div></form>
    <div className="drawing-save-row"><button className="quiet" disabled={!drawing.strokes.length || action.pending || !!pendingStroke || dirty} onClick={() => void saveMemory()}><Bookmark size={17} aria-hidden="true" />Save drawing to journal</button>{dirty && <span className="muted small-copy">Save the caption first.</span>}</div>
    {notice && <p className="activity-notice" role="status"><Check size={16} aria-hidden="true" />{notice}</p>}
    {action.error && <p className="form-error" role="alert">{action.error}</p>}
  </article>;
}
