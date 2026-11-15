"use client";
import { useState } from "react";
import {
  Check,
  CalendarPlus,
  ExternalLink,
  Pencil,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { useAction } from "@/components/space-provider";
import { formatInZone } from "@/shared/time";
import type { Person, Plan } from "@/shared/types";
import { PlanChecklist } from "./plan-checklist";
import { downloadCalendar } from "./calendar";

export function PlanCard({
  plan,
  members,
  me,
  onEdit,
}: {
  plan: Plan;
  members: Person[];
  me: Person;
  onEdit: () => void;
}) {
  const action = useAction();
  const [expanded, setExpanded] = useState(false);
  const [remove, setRemove] = useState(false);
  const [saved, setSaved] = useState(false);
  const date = new Intl.DateTimeFormat("en", {
    timeZone: me.timeZone,
    day: "numeric",
  }).format(new Date(plan.startsAt));
  const month = new Intl.DateTimeFormat("en", {
    timeZone: me.timeZone,
    month: "short",
  }).format(new Date(plan.startsAt));
  const mine = plan.acceptedBy.includes(me.id);
  async function update(body: unknown) {
    try {
      await action.run(`/api/plans/${plan.id}`, body, "PATCH");
    } catch {
      /* Error is displayed with this plan. */
    }
  }
  async function saveMemory() {
    try {
      await action.run("/api/entries", {
        kind: "memory",
        title: plan.title,
        body: plan.notes || "Something we did together.",
        collection: "Things we did",
      });
      setSaved(true);
    } catch {
      /* Keep the plan available for retry. */
    }
  }
  return (
    <article
      className={`plan-card${plan.status === "done" ? " plan-done" : ""}`}
    >
      <div className="plan-date">
        <span>{month}</span>
        <strong>{date}</strong>
      </div>
      <div className="plan-card-body">
        <div className="row spread wrap">
          <span className="plan-kind">
            {plan.kind === "call"
              ? "Call"
              : plan.kind === "visit"
                ? "In person"
                : "Remote activity"}{" "}
            · {plan.duration} min
          </span>
          <span className={`plan-status ${plan.status}`}>
            {plan.status === "accepted" ? (
              <>
                <Check size={13} />
                Agreed
              </>
            ) : plan.status === "done" ? (
              "Done"
            ) : (
              "Suggested"
            )}
          </span>
        </div>
        <h2>{plan.title}</h2>
        <div className="plan-times">
          {members.map((person) => (
            <p key={person.id}>
              <strong>{person.name}</strong>
              <span>{formatInZone(plan.startsAt, person.timeZone)}</span>
            </p>
          ))}
        </div>
        {plan.notes && <p className="plan-notes">{plan.notes}</p>}
        <div className="row wrap plan-actions">
          {plan.status !== "done" && (
            <>
              {plan.status === "proposed" && !mine && (
                <button
                  className="button"
                  disabled={action.pending || members.length < 2}
                  onClick={() => update({ accepted: true })}
                >
                  <Check size={15} />
                  Works for me
                </button>
              )}
              {plan.status === "proposed" && mine && (
                <span className="muted small">
                  Waiting for your partner’s response
                </span>
              )}
              <button className="quiet" onClick={onEdit}>
                <Pencil size={14} />
                Suggest a change
              </button>
              {plan.status === "accepted" && (
                <button
                  className="quiet"
                  disabled={action.pending}
                  onClick={() => update({ status: "done" })}
                >
                  Mark done
                </button>
              )}
            </>
          )}
          {plan.status === "done" && (
            <button
              className="secondary"
              disabled={action.pending || saved}
              onClick={saveMemory}
            >
              {saved ? "Saved to journal" : "Keep in journal"}
            </button>
          )}
          <button
            className="quiet"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            Details
            <ChevronDown size={14} />
          </button>
        </div>
        {expanded && (
          <div className="plan-details">
            {plan.link && (
              <a
                className="secondary"
                href={plan.link}
                rel="noopener noreferrer"
                target="_blank"
              >
                Open link
                <ExternalLink size={14} />
              </a>
            )}
            <PlanChecklist plan={plan} />
            <div className="row wrap">
              <button className="quiet" onClick={() => downloadCalendar(plan)}>
                <CalendarPlus size={15} />
                Add to calendar
              </button>
              {plan.proposedBy === me.id && (
                <button
                  className="quiet danger"
                  onClick={() => setRemove(!remove)}
                >
                  <Trash2 size={14} />
                  Delete plan
                </button>
              )}
            </div>
            {remove && (
              <div className="plan-delete">
                <p>This removes the plan for both of you.</p>
                <button
                  className="secondary danger"
                  disabled={action.pending}
                  onClick={() =>
                    void action
                      .run(`/api/plans/${plan.id}`, undefined, "DELETE")
                      .catch(() => {})
                  }
                >
                  Delete this plan
                </button>
                <button className="quiet" onClick={() => setRemove(false)}>
                  Keep it
                </button>
              </div>
            )}
          </div>
        )}
        {action.error && (
          <p className="form-error" role="alert">
            {action.error}
          </p>
        )}
      </div>
    </article>
  );
}
