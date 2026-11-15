"use client";

import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ImagePlus, Plus } from "lucide-react";
import { useAction } from "@/components/space-provider";
import type { Person, PhotoPair } from "@/shared/types";
import { JournalDialog } from "./journal-dialog";
import { MediaPicker } from "./media-picker";
import { useMediaUpload } from "./use-media-upload";
import "./photo-pairs.css";

const promptSchema = z.object({ prompt: z.string().trim().min(1, "Choose a subject for your photos.").max(160, "Keep the prompt under 160 characters.") });
const captionSchema = z.object({ caption: z.string().max(1000, "Keep the caption under 1,000 characters.") });

function NewPhotoPair({ onClose }: { onClose: () => void }) {
  const action = useAction();
  const id = useId();
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof promptSchema>>({ resolver: zodResolver(promptSchema), defaultValues: { prompt: "" } });
  return <JournalDialog title="Start a photo pair" onClose={onClose} busy={action.pending}>
    <form className="journal-compose-form" onSubmit={handleSubmit(async values => { try { await action.run("/api/photo-pairs", values); onClose(); } catch { /* Preserve the prompt for retry. */ } })} noValidate>
      <label className="field" htmlFor={id}>What will you photograph?<input id={id} maxLength={160} placeholder="The sky where you are" {...register("prompt")} aria-invalid={Boolean(errors.prompt)} />{errors.prompt && <span className="journal-field-error">{errors.prompt.message}</span>}<small>You each add a photo, whenever you like. Photos appear as soon as they’re added.</small></label>
      {action.error && <p className="form-error" role="alert">{action.error}</p>}
      <div className="journal-edit-footer"><button className="secondary" type="button" disabled={action.pending} onClick={onClose}>Cancel</button><button className="button" type="submit" disabled={action.pending}>{action.pending ? "Creating…" : "Create photo pair"}</button></div>
    </form>
  </JournalDialog>;
}

function PhotoContribution({ pair, me, onClose }: { pair: PhotoPair; me: Person; onClose: () => void }) {
  const existing = pair.photos.find(photo => photo.userId === me.id);
  const upload = useMediaUpload();
  const action = useAction();
  const [localError, setLocalError] = useState<string | null>(null);
  const id = useId();
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof captionSchema>>({ resolver: zodResolver(captionSchema), defaultValues: { caption: existing?.caption || "" } });
  async function submit(values: z.infer<typeof captionSchema>) {
    setLocalError(null);
    const mediaId = upload.mediaId || existing?.mediaId;
    if (!mediaId) { setLocalError("Choose and upload your photo first."); return; }
    if (upload.file && upload.status !== "ready") { setLocalError("Finish uploading the selected photo, or remove it to keep your previous photo."); return; }
    try { await action.run(`/api/photo-pairs/${pair.id}`, { mediaId, caption: values.caption.trim() }); onClose(); }
    catch { /* Keep file and caption available for retry. */ }
  }
  return <JournalDialog title={pair.prompt} onClose={onClose} busy={action.pending}>
    <form className="journal-compose-form" onSubmit={handleSubmit(submit)} noValidate>
      {existing && !upload.file && <div className="journal-existing-pair-photo"><img src={`/api/media/${existing.mediaId}`} alt={existing.caption || "Your current photo"} /><span className="muted">Your current photo</span></div>}
      <MediaPicker upload={upload} label={existing ? "Replace your photo" : "Add your photo"} />
      <label className="field" htmlFor={id}>Caption<textarea id={id} rows={3} maxLength={1000} placeholder="Describe your photo." {...register("caption")} aria-invalid={Boolean(errors.caption)} />{errors.caption && <span className="journal-field-error">{errors.caption.message}</span>}</label>
      {(localError || action.error) && <p className="form-error" role="alert">{localError || action.error}</p>}
      <div className="journal-edit-footer"><button className="button" type="submit" disabled={action.pending || upload.status === "uploading"}>{action.pending ? "Saving…" : existing ? "Save your photo" : "Add to photo pair"}</button></div>
    </form>
  </JournalDialog>;
}

export function PhotoPairs({ pairs, members, me }: { pairs: PhotoPair[]; members: Person[]; me: Person }) {
  const [creating, setCreating] = useState(false);
  const [contributionId, setContributionId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const sorted = [...pairs].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const contribution = pairs.find(pair => pair.id === contributionId);
  const viewed = pairs.find(pair => pair.id === viewId);
  const slots: (Person | null)[] = members.length < 2 ? [...members, null] : members;

  return <section className="journal-photo-pairs" aria-labelledby="journal-pairs-title">
    <div className="journal-pairs-heading"><h2 id="journal-pairs-title">Photo pairs</h2><button type="button" className="quiet" onClick={() => setCreating(true)}><Plus size={16} /> Start a pair</button></div>
    {pairs.length === 0 ? <p className="journal-pairs-empty">Choose a subject and add one photo from each place.</p> : <div className="journal-pairs-list">{(showAll ? sorted : sorted.slice(0, 3)).map(pair => <article className="journal-pair" key={pair.id}>
      <h3>{pair.prompt}</h3>
      <div className="journal-pair-photos">{slots.map((person, index) => {
        const photo = pair.photos.find(item => item.userId === person?.id);
        const mine = person?.id === me.id;
        return <figure key={person?.id || `empty-${index}`}>
          {photo ? <button type="button" className="journal-pair-photo" aria-label={`View ${person?.name}’s photo`} onClick={() => setViewId(pair.id)}><img src={`/api/media/${photo.mediaId}`} alt={photo.caption || `Photo from ${person?.name}`} loading="lazy" /></button> : mine ? <button type="button" className="journal-pair-placeholder" onClick={() => setContributionId(pair.id)}><ImagePlus size={24} aria-hidden="true" /><span>Add your photo</span></button> : <div className="journal-pair-placeholder"><ImagePlus size={24} aria-hidden="true" /><span>No photo yet</span></div>}
          <figcaption>{person?.name || "Your partner"}</figcaption>
        </figure>;
      })}</div>
      {pair.photos.some(photo => photo.userId === me.id) && <button type="button" className="quiet journal-pair-edit" onClick={() => setContributionId(pair.id)}>Edit your photo</button>}
    </article>)}</div>}
    {sorted.length > 3 && <button type="button" className="quiet" onClick={() => setShowAll(value => !value)}>{showAll ? "Show fewer pairs" : `Show all ${sorted.length} pairs`}</button>}
    {creating && <NewPhotoPair onClose={() => setCreating(false)} />}
    {contribution && <PhotoContribution pair={contribution} me={me} onClose={() => setContributionId(null)} />}
    {viewed && <JournalDialog title={viewed.prompt} wide onClose={() => setViewId(null)}><div className="journal-pair-full">{slots.map((person, index) => {
      const photo = viewed.photos.find(item => item.userId === person?.id);
      return <figure key={person?.id || index}>{photo ? <img src={`/api/media/${photo.mediaId}`} alt={photo.caption || `Photo from ${person?.name}`} /> : <div className="journal-pair-placeholder">No photo yet</div>}<figcaption><strong>{person?.name || "Your partner"}</strong>{photo?.caption && <p>{photo.caption}</p>}</figcaption></figure>;
    })}</div></JournalDialog>}
  </section>;
}
