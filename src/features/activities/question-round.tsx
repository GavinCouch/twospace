"use client";

import { useState } from "react";
import { LockKeyhole, Check, MessageCircle } from "lucide-react";
import { PersonAvatar } from "@/components/person-avatar";
import { useAction } from "@/components/space-provider";
import type { QuestionRound, SpaceSnapshot } from "@/shared/types";

export function QuestionCard({
  round,
  space,
}: {
  round: QuestionRound;
  space: SpaceSnapshot;
}) {
  const action = useAction();
  const [body, setBody] = useState("");
  const [reveal, setReveal] = useState({
    id: round.id,
    complete: round.complete,
    active: false,
  });
  if (reveal.id !== round.id || reveal.complete !== round.complete) {
    setReveal({
      id: round.id,
      complete: round.complete,
      active: reveal.id === round.id && !reveal.complete && round.complete,
    });
  }
  const mine = round.answers.find((answer) => answer.userId === space.me.id);
  async function answer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (action.pending || !body.trim()) return;
    try {
      await action.run(`/api/questions/${round.id}/answers`, {
        body: body.trim(),
      });
      setBody("");
    } catch {
      /* Preserve the draft for retry. */
    }
  }
  return (
    <article
      className={`panel question-round${round.complete ? " question-complete" : ""}`}
    >
      <div className="activity-heading">
        <span className="activity-eyebrow">{round.category}</span>
        <span className="question-status">
          {round.complete ? (
            <>
              <Check size={14} aria-hidden="true" />
              Both answered
            </>
          ) : (
            <>
              <LockKeyhole size={14} aria-hidden="true" />
              Answers open together
            </>
          )}
        </span>
      </div>
      <h3>{round.prompt}</h3>
      <div
        className={`answer-pair${reveal.active ? " answers-revealing" : ""}`}
        aria-live="polite"
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget)
            setReveal((current) => ({ ...current, active: false }));
        }}
      >
        {space.members.map((member) => {
          const response = round.answers.find(
            (answer) => answer.userId === member.id,
          );
          return (
            <div
              className={`answer-card${response?.body ? " answer-visible" : ""}`}
              key={member.id}
            >
              <span className="answer-name">
                <PersonAvatar person={member} size={22} />
                <span>
                  {member.name}
                  {member.id === space.me.id ? " · you" : ""}
                </span>
              </span>
              {response?.body ? (
                <p>{response.body}</p>
              ) : response ? (
                <p className="muted">
                  <LockKeyhole size={15} aria-hidden="true" />
                  Answer saved. It opens when you both answer.
                </p>
              ) : (
                <p className="muted">
                  {member.id === space.me.id
                    ? "Your answer goes here."
                    : "They can answer whenever they like."}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {!mine && (
        <form className="question-answer-form" onSubmit={answer}>
          <label className="field">
            Your answer
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              readOnly={action.pending}
              maxLength={2000}
              rows={3}
              required
              placeholder="Write what comes to mind…"
            />
          </label>
          <div className="activity-heading">
            <p className="muted small-copy">
              Your partner cannot read this until you have both answered.
            </p>
            <button
              className="button"
              disabled={
                action.pending || !body.trim() || space.members.length < 2
              }
            >
              {action.pending ? "Saving…" : "Save my answer"}
            </button>
          </div>
        </form>
      )}
      {mine && !round.complete && (
        <p className="muted small-copy">
          <MessageCircle size={15} aria-hidden="true" />
          Your answer is saved. Come back whenever you like.
        </p>
      )}
      {action.error && (
        <p className="form-error" role="alert">
          {action.error}
        </p>
      )}
    </article>
  );
}
