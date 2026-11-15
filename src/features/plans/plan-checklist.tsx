"use client";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useAction } from "@/components/space-provider";
import type { Plan } from "@/shared/types";
export function PlanChecklist({ plan }: { plan: Plan }) {
  const [text, setText] = useState("");
  const action = useAction();
  async function change(type: "add" | "toggle" | "remove", id?: string) {
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
    <div className="plan-checklist">
      <h3>Things to bring or do</h3>
      {plan.checklist.map((item) => (
        <div className="checklist-item" key={item.id}>
          <label>
            <input
              type="checkbox"
              checked={item.done}
              disabled={action.pending}
              onChange={() => change("toggle", item.id)}
            />
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
