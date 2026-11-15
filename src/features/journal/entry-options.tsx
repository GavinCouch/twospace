"use client";

import { useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Folder, MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { useAction } from "@/components/space-provider";
import type { Entry } from "@/shared/types";
import { JournalDialog } from "./journal-dialog";
import { noteSchema, type NoteValues } from "./journal-utils";
import "./entry-actions.css";

function EntryEditor({ entry, isAuthor, collections, onClose }: { entry: Entry; isAuthor: boolean; collections: string[]; onClose: () => void }) {
  const id = useId();
  const action = useAction();
  const { register, handleSubmit, setError, formState: { errors } } = useForm<NoteValues>({ resolver: zodResolver(noteSchema), defaultValues: { body: entry.body, title: entry.title, collection: entry.collection } });
  async function save(values: NoteValues) {
    if (isAuthor && entry.kind === "note" && !values.body.trim()) { setError("body", { message: "Write something before saving the note." }); return; }
    try {
      await action.run(`/api/entries/${entry.id}`, isAuthor ? { body: values.body.trim(), title: values.title.trim(), collection: values.collection.trim() } : { collection: values.collection.trim() }, "PATCH");
      onClose();
    } catch { /* Keep edits available for retry. */ }
  }
  return <JournalDialog title={isAuthor ? "Edit entry" : "Choose a collection"} onClose={onClose} busy={action.pending}>
    <form className="journal-compose-form" onSubmit={handleSubmit(save)} noValidate>
      {isAuthor && <>
        <label className="field" htmlFor={`${id}-title`}>Title <input id={`${id}-title`} maxLength={120} {...register("title")} aria-invalid={Boolean(errors.title)} />{errors.title && <span className="journal-field-error">{errors.title.message}</span>}</label>
        <label className="field" htmlFor={`${id}-body`}>{entry.kind === "voice" ? "Caption or transcript" : entry.kind === "photo" ? "Caption" : "Note"}<textarea id={`${id}-body`} rows={6} maxLength={6000} {...register("body")} aria-invalid={Boolean(errors.body)} />{errors.body && <span className="journal-field-error">{errors.body.message}</span>}</label>
      </>}
      <label className="field" htmlFor={`${id}-collection`}>Collection<input id={`${id}-collection`} maxLength={40} list={`${id}-collections`} {...register("collection")} placeholder="Choose or make a collection" />{errors.collection && <span className="journal-field-error">{errors.collection.message}</span>}<small>Leave blank to remove it from a collection.</small></label>
      <datalist id={`${id}-collections`}>{collections.map(name => <option key={name} value={name} />)}</datalist>
      {action.error && <p className="form-error" role="alert">{action.error}</p>}
      <div className="journal-edit-footer"><button className="secondary" type="button" disabled={action.pending} onClick={onClose}>Cancel</button><button className="button" type="submit" disabled={action.pending}>{action.pending ? "Saving…" : "Save changes"}</button></div>
    </form>
  </JournalDialog>;
}

export function EntryOptions({ entry, meId, collections }: { entry: Entry; meId: string; collections: string[] }) {
  const action = useAction();
  const details = useRef<HTMLDetailsElement>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isAuthor = entry.authorId === meId;
  function closeMenu() { if (details.current) details.current.open = false; }
  return <div className="journal-entry-options">
    <details ref={details} className="journal-options-menu">
      <summary className="quiet journal-icon-button" aria-label="Entry options"><MoreHorizontal size={20} /></summary>
      <div className="journal-menu-items">
        <button type="button" disabled={action.pending} onClick={() => { closeMenu(); void action.run(`/api/entries/${entry.id}`, { pinned: !entry.pinned }, "PATCH").catch(() => {}); }}>{entry.pinned ? <PinOff size={16} /> : <Pin size={16} />}{entry.pinned ? "Unpin entry" : "Pin entry"}</button>
        <button type="button" onClick={() => { closeMenu(); setEditing(true); }}>{isAuthor ? <Pencil size={16} /> : <Folder size={16} />}{isAuthor ? "Edit entry" : "Move to collection"}</button>
        {isAuthor && <button className="danger" type="button" onClick={() => { closeMenu(); setDeleting(true); }}><Trash2 size={16} /> Delete entry</button>}
      </div>
    </details>
    {action.error && !deleting && <p className="form-error journal-option-error" role="alert">{action.error}</p>}
    {editing && <EntryEditor entry={entry} isAuthor={isAuthor} collections={collections} onClose={() => setEditing(false)} />}
    {deleting && <JournalDialog title="Delete this entry?" onClose={() => setDeleting(false)} busy={action.pending}>
      <p className="journal-delete-copy">This removes the entry and its replies from your shared journal.</p>
      {action.error && <p className="form-error" role="alert">{action.error}</p>}
      <div className="journal-edit-footer"><button type="button" className="secondary" disabled={action.pending} onClick={() => setDeleting(false)}>Keep entry</button><button type="button" className="button journal-delete-button" disabled={action.pending} onClick={() => { void action.run(`/api/entries/${entry.id}`, undefined, "DELETE").then(() => setDeleting(false)).catch(() => {}); }}>{action.pending ? "Deleting…" : "Delete entry"}</button></div>
    </JournalDialog>}
  </div>;
}
