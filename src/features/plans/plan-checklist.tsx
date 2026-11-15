"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { useAction } from "@/components/space-provider";
import type { Plan } from "@/shared/types";
export function PlanChecklist({ plan }: { plan: Plan }) {
  const [text, setText] = useState("");
  const [justCompleted, setJustCompleted] = useState(false);
  const action = useAction();
  const total = plan.checklist.length;
  const completed = plan.checklist.filter((item) => item.done).length;
  const previous = useRef({ id: plan.id, total, completed });

  useEffect(() => {
    if (action.pending) return;
    const before = previous.current;
    previous.current = { id: plan.id, total, completed };
    if (completed !== total || before.id !== plan.id) {
      setJustCompleted(false);
    } else if (!action.error && total > 0 && before.completed < before.total) {
      setJustCompleted(true);
    }
  }, [plan.id, total, completed, action.pending, action.error]);

  useEffect(() => {
    if (!justCompleted) return;
    const timeout = window.setTimeout(() => setJustCompleted(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [justCompleted]);

  async function change(type: "add" | "toggle" | "remove", id?: string) {
    setJustCompleted(false);
    try {
      await action.run(
        `/api/plans/${plan.id}`,
        {
          checklistAction: {
            type,
            id,
            text: type === "add" ? text : undefined,
          },
        },
        "PATCH",
      );
      if (type === "add") setText("");
    } catch {
      /* Keep the item text for retry. */
    }
  }
  return (
    <div
      className={`plan-checklist${justCompleted ? " checklist-just-completed" : ""}`}
    >
      <div className="checklist-heading">
        <h3>Things to bring or do</h3>
        {total > 0 && (
          <span className="checklist-count">
            {completed === total && <Check size={13} aria-hidden="true" />}
            {completed}/{total} ready
          </span>
        )}
      </div>
      {total > 0 && (
        <div
          className="checklist-progress"
          role="progressbar"
          aria-label="Checklist progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={completed}
          aria-valuetext={`${completed} of ${total} ready`}
        >
          <span style={{ transform: `scaleX(${completed / total})` }} />
        </div>
      )}
      <p className="sr-only" role="status">
        {justCompleted ? "Checklist complete." : ""}
      </p>
      {plan.checklist.map((item) => (
        <div className="checklist-item" key={item.id}>
          <label>
            <span className="checklist-control">
              <input
                type="checkbox"
                checked={item.done}
                disabled={action.pending}
                onChange={() => change("toggle", item.id)}
              />
              <Check className="checklist-tick" size={13} aria-hidden="true" />
            </span>
            <span className={item.done ? "completed" : ""}>{item.text}</span>
          </label>
          <button
            type="button"
            className="quiet"
            aria-label={`Remove ${item.text}`}
            disabled={action.pending}
            onClick={() => change("remove", item.id)}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          void change("add");
        }}
      >
        <label className="field">
          <span className="sr-only">Checklist item</span>
          <input
            placeholder="Add something"
            value={text}
            maxLength={160}
            readOnly={action.pending}
            onChange={(e) => setText(e.target.value)}
            required
          />
        </label>
        <button
          className="secondary"
          aria-label="Add checklist item"
          disabled={action.pending || !text.trim()}
        >
          <Plus size={17} />
        </button>
      </form>
      {action.error && (
        <p className="form-error" role="alert">
          {action.error}
        </p>
      )}
    </div>
  );
}
