"use client";

import { useState } from "react";
import { Plus, Shuffle, ArrowRight, MessagesSquare } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAction } from "@/components/space-provider";
import { QUESTION_PROMPTS } from "@/shared/content";
import type { SpaceSnapshot } from "@/shared/types";
import { QuestionCard } from "./question-round";

const schema = z.object({ prompt: z.string().trim().min(8, "Add a little more to your question.").max(300, "Keep your question under 300 characters.") });

export function QuestionsPanel({ space }: { space: SpaceSnapshot }) {
  const action = useAction();
  const [category, setCategory] = useState("Today");
  const [index, setIndex] = useState(0);
  const [custom, setCustom] = useState(false);
  const [history, setHistory] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ prompt: string }>({ resolver: zodResolver(schema) });
  const choices = QUESTION_PROMPTS.filter(question => question.category === category);
  const chosen = choices[index % choices.length];
  const rounds = [...space.questions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const visible = history ? rounds : rounds.filter(round => !round.complete).concat(rounds.filter(round => round.complete).slice(0, 1));
  async function start(prompt: string, selectedCategory: string) {
    try { await action.run("/api/questions", { prompt, category: selectedCategory }); reset(); setCustom(false); } catch { /* Request errors stay with the chooser. */ }
  }
  return <div className="questions-panel">
    <div className="activity-section-intro"><div><h2>Something to ask each other</h2><p className="muted">Answer separately, then open both answers together. No timer, and no need to answer every question.</p></div></div>
    <div className="question-chooser panel">
      <div className="activity-heading"><label className="field compact"><span className="sr-only">Question category</span><select value={category} onChange={event => { setCategory(event.target.value); setIndex(0); }}>{Array.from(new Set(QUESTION_PROMPTS.map(question => question.category))).map(value => <option key={value}>{value}</option>)}</select></label><button className="quiet" aria-expanded={custom} onClick={() => setCustom(!custom)}><Plus size={16} aria-hidden="true" />Write your own</button></div>
      {custom ? <form className="custom-question-form" onSubmit={handleSubmit(values => start(values.prompt, "Our question"))}><label className="field">Your question<textarea autoFocus {...register("prompt")} maxLength={300} rows={3} aria-invalid={!!errors.prompt} /></label>{errors.prompt && <p className="form-error" role="alert">{errors.prompt.message}</p>}<button className="button" disabled={action.pending || space.members.length < 2}>{action.pending ? "Adding…" : "Ask this question"}</button></form> : <><div className="question-prompt"><MessagesSquare size={28} aria-hidden="true" /><h3>{chosen.prompt}</h3></div><div className="activity-heading"><button className="quiet" onClick={() => setIndex(index + 1)}><Shuffle size={16} aria-hidden="true" />Another question</button><button className="button" onClick={() => void start(chosen.prompt, chosen.category)} disabled={action.pending || space.members.length < 2}>{action.pending ? "Adding…" : "Ask this question"}<ArrowRight size={16} aria-hidden="true" /></button></div></>}
      {space.members.length < 2 && <p className="muted small-copy">Pair with your partner before starting a shared question.</p>}
      {action.error && <p className="form-error" role="alert">{action.error}</p>}
    </div>
    {rounds.length > 0 && <div className="activity-heading questions-list-heading"><h2>Your questions</h2><button className="quiet" aria-pressed={history} onClick={() => setHistory(!history)}>{history ? "Show recent" : `All questions (${rounds.length})`}</button></div>}
    <div className="question-list">{visible.map(round => <QuestionCard key={round.id} round={round} space={space} />)}</div>
  </div>;
}
