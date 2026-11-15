"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAction } from "@/components/space-provider";
import type { Game } from "@/shared/types";

const schema = z.object({
  answer: z
    .string()
    .trim()
    .min(2, "Choose an answer with at least two characters.")
    .max(80),
  clue1: z.string().trim().min(3, "Add your first clue.").max(160),
  clue2: z.string().trim().min(3, "Add a second clue.").max(160),
  clue3: z.string().trim().min(3, "Add one more clue.").max(160),
});
type Values = z.infer<typeof schema>;

export function WordCreate({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const action = useAction();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) });
  async function create(values: Values) {
    try {
      const game = await action.run<Game>("/api/games", {
        kind: "word",
        answer: values.answer,
        clues: [values.clue1, values.clue2, values.clue3],
      });
      onClose();
      if (game.id) onCreated?.(game.id);
    } catch {
      /* Keep all clues available to retry. */
    }
  }
  return (
    <form className="panel activity-form" onSubmit={handleSubmit(create)}>
      <div className="activity-heading">
        <div>
          <span className="activity-eyebrow">Three clues</span>
          <h3>Something for your partner to guess</h3>
        </div>
        <button type="button" className="quiet" onClick={onClose}>
          Cancel
        </button>
      </div>
      <label className="field">
        Secret answer
        <input
          autoFocus
          autoComplete="off"
          {...register("answer")}
          maxLength={80}
          aria-invalid={!!errors.answer}
          placeholder="An object, place or character"
        />
      </label>
      <p className="muted small-copy">
        Your partner sees the clues. Your answer stays hidden until they guess
        it.
      </p>
      {errors.answer && (
        <p className="form-error" role="alert">
          {errors.answer.message}
        </p>
      )}
      {(["clue1", "clue2", "clue3"] as const).map((name, index) => (
        <div key={name}>
          <label className="field">
            Clue {index + 1}
            <input
              {...register(name)}
              maxLength={160}
              aria-invalid={!!errors[name]}
              placeholder={
                [
                  "Start a little vague",
                  "Narrow it down",
                  "Give them something to work with",
                ][index]
              }
            />
          </label>
          {errors[name] && (
            <p className="form-error" role="alert">
              {errors[name]?.message}
            </p>
          )}
        </div>
      ))}
      {action.error && (
        <p className="form-error" role="alert">
          {action.error}
        </p>
      )}
      <button className="button" disabled={action.pending}>
        {action.pending ? "Saving…" : "Leave these clues"}
      </button>
    </form>
  );
}
