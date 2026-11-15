"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useAction } from "@/components/space-provider";
import { dateTimeInZone, formatInZone, localToInstant } from "@/shared/time";
import type { Person, Plan } from "@/shared/types";

const schema = z.object({
  title: z.string().trim().min(1, "Give the plan a name.").max(160),
  localTime: z.string().min(1, "Choose a date and time."),
  timeZone: z.string().min(1),
  duration: z.number().int().min(5).max(1440),
  kind: z.enum(["call", "date", "visit"]),
  link: z
    .string()
    .max(2000)
    .refine(
      (value) => !value || /^https?:\/\//i.test(value),
      "Use an http or https link.",
    ),
  notes: z.string().max(4000),
});
type Fields = z.infer<typeof schema>;
export function PlanForm({
  members,
  me,
  initial,
  suggestedTitle = "",
  suggestedDuration = 30,
  suggestedTime,
  onClose,
}: {
  members: Person[];
  me: Person;
  initial?: Plan;
  suggestedTitle?: string;
  suggestedDuration?: number;
  suggestedTime?: string;
  onClose: () => void;
}) {
  const action = useAction();
  const [timeError, setTimeError] = useState("");
  const form = useForm<Fields>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initial?.title || suggestedTitle,
      localTime: dateTimeInZone(
        initial?.startsAt ||
          suggestedTime ||
          new Date(Date.now() + 86400000).toISOString(),
        initial?.timeZone || me.timeZone,
      ),
      timeZone: initial?.timeZone || me.timeZone,
      duration: initial?.duration || suggestedDuration,
      kind: initial?.kind || "date",
      link: initial?.link || "",
      notes: initial?.notes || "",
    },
  });
  const localTime = form.watch("localTime"),
    timeZone = form.watch("timeZone");
  let preview: string | null = null;
  try {
    preview = localToInstant(localTime, timeZone);
  } catch {
    /* A partial datetime remains editable. */
  }
  async function submit(values: Fields) {
    setTimeError("");
    try {
      const startsAt = localToInstant(values.localTime, values.timeZone);
      await action.run(
        initial ? `/api/plans/${initial.id}` : "/api/plans",
        {
          title: values.title,
          startsAt,
          timeZone: values.timeZone,
          duration: values.duration,
          kind: values.kind,
          link: values.link,
          notes: values.notes,
        },
        initial ? "PATCH" : "POST",
      );
      onClose();
    } catch (cause) {
      setTimeError(
        cause instanceof Error
          ? cause.message
          : "Check the plan and try again.",
      );
    }
  }
  return (
    <form className="stack plan-form" onSubmit={form.handleSubmit(submit)}>
      <div className="row spread">
        <h2>{initial ? "Suggest a change" : "Suggest a plan"}</h2>
        <button className="quiet" type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
      <label className="field">
        What would you like to do?
        <input
          placeholder="Cook the same recipe"
          {...form.register("title")}
          autoFocus
        />
        {form.formState.errors.title && (
          <small className="danger">
            {form.formState.errors.title.message}
          </small>
        )}
      </label>
      <div className="plan-form-pair">
        <label className="field">
          Type
          <select {...form.register("kind")}>
            <option value="date">Remote activity</option>
            <option value="call">Call</option>
            <option value="visit">In person</option>
          </select>
        </label>
        <label className="field">
          Minutes
          <input
            type="number"
            min={5}
            max={1440}
            {...form.register("duration", { valueAsNumber: true })}
          />
          {form.formState.errors.duration && (
            <small className="danger">Choose 5–1,440 minutes.</small>
          )}
        </label>
      </div>
      <div className="plan-form-pair">
        <label className="field">
          Date and time
          <input type="datetime-local" {...form.register("localTime")} />
        </label>
        <label className="field">
          Time zone
          <select {...form.register("timeZone")}>
            {[...new Set([me.timeZone, ...members.map((p) => p.timeZone)])].map(
              (zone) => (
                <option key={zone}>{zone}</option>
              ),
            )}
          </select>
        </label>
      </div>
      {preview && (
        <div className="time-preview" aria-live="polite">
          {members.map((person) => (
            <div key={person.id}>
              <strong>{person.name}</strong>
              <span>{formatInZone(preview!, person.timeZone)}</span>
            </div>
          ))}
        </div>
      )}
      <label className="field">
        Call or activity link <span className="muted small">Optional</span>
        <input type="url" placeholder="https://" {...form.register("link")} />
        {form.formState.errors.link && (
          <small className="danger">{form.formState.errors.link.message}</small>
        )}
      </label>
      <label className="field">
        Details <span className="muted small">Optional</span>
        <textarea
          placeholder="Anything to bring, make, or decide beforehand"
          {...form.register("notes")}
        />
      </label>
      {(timeError || action.error) && (
        <p className="form-error" role="alert">
          {timeError || action.error}
        </p>
      )}
      <button className="button" disabled={action.pending}>
        {action.pending
          ? "Saving…"
          : initial
            ? "Send the suggestion"
            : "Suggest this time"}
      </button>
      <p className="muted small">
        Your partner can accept or suggest a different time.
      </p>
    </form>
  );
}
