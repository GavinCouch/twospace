"use client";

import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Heart, MessageCircle, Send } from "lucide-react";
import { useAction } from "@/components/space-provider";
import type { Entry, Person } from "@/shared/types";
import { entryDate } from "./journal-utils";

const replySchema = z.object({ body: z.string().trim().min(1, "Write a reply first.").max(2000, "Keep your reply under 2,000 characters.") });

export function EntryConversation({ entry, members, me }: { entry: Entry; members: Person[]; me: Person }) {
  const reaction = useAction();
  const reply = useAction();
  const [expanded, setExpanded] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const id = useId();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.infer<typeof replySchema>>({ resolver: zodResolver(replySchema), defaultValues: { body: "" } });
  const reacted = entry.reactions.includes(me.id);
  const partnerHearts = members.filter(person => person.id !== me.id && entry.reactions.includes(person.id));

  async function addReply(values: z.infer<typeof replySchema>) {
    setAnnouncement("");
    try { await reply.run(`/api/entries/${entry.id}/replies`, values); reset(); setAnnouncement("Reply added."); }
    catch { /* Keep the reply text on failure. */ }
  }

  return <div className="journal-conversation">
    <div className="journal-entry-actions">
      <button type="button" className={`quiet journal-heart-button${reacted ? " is-selected" : ""}`} aria-pressed={reacted} aria-label={reacted ? "Remove your heart" : "Send a heart"} disabled={reaction.pending} onClick={() => { void reaction.run(`/api/entries/${entry.id}/reaction`, {}).catch(() => {}); }}><Heart size={17} fill={reacted ? "currentColor" : "none"} />{reacted ? "Heart sent" : "Heart"}</button>
      <button type="button" className="quiet" aria-expanded={expanded} aria-controls={`${id}-replies`} onClick={() => setExpanded(value => !value)}><MessageCircle size={17} />{entry.replies.length ? `${entry.replies.length} ${entry.replies.length === 1 ? "reply" : "replies"}` : "Reply"}</button>
      {partnerHearts.length > 0 && <span className="journal-heart-byline">{partnerHearts.map(person => person.name).join(", ")} left a heart</span>}
    </div>
    {reaction.error && <p className="form-error" role="alert">{reaction.error}</p>}
    <div id={`${id}-replies`} hidden={!expanded} className="journal-replies">
      {entry.replies.length > 0 && <ol className="journal-reply-list">{entry.replies.map(item => <li key={item.id}>
        <div className="journal-reply-byline"><strong>{members.find(person => person.id === item.authorId)?.name || "Member"}</strong><time dateTime={item.createdAt}>{entryDate(item.createdAt, me.timeZone)}</time></div>
        <p>{item.body}</p>
      </li>)}</ol>}
      {entry.replies.length < 100 ? <form className="journal-reply-form" onSubmit={handleSubmit(addReply)} noValidate>
        <label className="field" htmlFor={`${id}-reply`}>Your reply<textarea id={`${id}-reply`} rows={2} maxLength={2000} placeholder="Write a reply…" {...register("body")} aria-invalid={Boolean(errors.body)} aria-describedby={errors.body ? `${id}-reply-error` : undefined} /></label>
        {errors.body && <p className="journal-field-error" id={`${id}-reply-error`}>{errors.body.message}</p>}
        {reply.error && <p className="form-error" role="alert">{reply.error}</p>}
        <div className="journal-reply-footer"><span className="journal-visually-hidden" role="status">{announcement}</span><button type="submit" className="secondary" disabled={reply.pending}><Send size={15} />{reply.pending ? "Sending…" : "Send reply"}</button></div>
      </form> : <p className="muted">This entry has reached its 100-reply limit.</p>}
    </div>
  </div>;
}
