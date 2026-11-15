"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, CalendarDays } from "lucide-react";
import { useSpace } from "@/components/space-provider";
import type { Plan, SpaceSnapshot } from "@/shared/types";
import { PlanForm } from "./plan-form";
import { PlanCard } from "./plan-card";
import { Availability } from "./availability";
import "./plans.css";

export default function PlansPage() {
  const { data } = useSpace();
  return data ? <PlansContent space={data} /> : null;
}
function PlansContent({ space }: { space: SpaceSnapshot }) {
  const params = useSearchParams();
  const router = useRouter();
  const [form, setForm] = useState(Boolean(params.get("title")));
  const [editing, setEditing] = useState<Plan | undefined>();
  const [suggestedTime, setSuggestedTime] = useState<string | undefined>();
  const [filter, setFilter] = useState("upcoming");
  const [availability, setAvailability] = useState(false);
  const plans = [...space.plans]
    .filter((plan) =>
      filter === "done" ? plan.status === "done" : plan.status !== "done",
    )
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const duration = Number(params.get("duration") || 30);
  function close() {
    setForm(false);
    setEditing(undefined);
    setSuggestedTime(undefined);
    if (params.size) router.replace("/plans");
  }
  return (
    <div className="plans-page">
      <header className="page-title">
        <div>
          <h1>Plans</h1>
        </div>
        <button
          className="button"
          onClick={() => {
            setEditing(undefined);
            setForm(true);
          }}
        >
          <Plus size={17} />
          New plan
        </button>
      </header>
      <div className="plans-layout">
        <section>
          <div className="tabs" role="tablist" aria-label="Plan status">
            <button
              role="tab"
              aria-selected={filter === "upcoming"}
              onClick={() => setFilter("upcoming")}
            >
              Upcoming
            </button>
            <button
              role="tab"
              aria-selected={filter === "done"}
              onClick={() => setFilter("done")}
            >
              Past activities
            </button>
          </div>
          {plans.length ? (
            <div className="plan-list">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  members={space.members}
                  me={space.me}
                  onEdit={() => {
                    setEditing(plan);
                    setForm(true);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="empty">
              <CalendarDays size={30} />
              <h2>
                {filter === "done" ? "No completed plans yet" : "No plans yet"}
              </h2>
              <p>
                {filter === "done"
                  ? "Mark a plan done when you’ve finished."
                  : "Suggest a call, an activity, or an optional in-person plan."}
              </p>
              {filter === "upcoming" && (
                <button className="secondary" onClick={() => setForm(true)}>
                  Suggest something
                </button>
              )}
            </div>
          )}
        </section>
        <aside className="plans-side">
          <section className="panel">
            <h2>Both of your clocks</h2>
            <p className="muted small">
              Compare your usual free hours before picking a time.
            </p>
            <button
              className="secondary"
              aria-expanded={availability}
              onClick={() => setAvailability(!availability)}
            >
              {availability ? "Hide time finder" : "Find a time"}
            </button>
          </section>
          {availability && (
            <Availability
              members={space.members}
              me={space.me}
              onChoose={(instant) => {
                setSuggestedTime(instant);
                setEditing(undefined);
                setForm(true);
              }}
            />
          )}
          <section className="plans-saved">
            <h2>Saved ideas</h2>
            {space.ideas
              .filter((idea) => idea.savedBy.length)
              .slice(0, 5)
              .map((idea) => (
                <a
                  key={idea.id}
                  href={`/plans?title=${encodeURIComponent(idea.title)}&duration=${idea.duration}`}
                  onClick={(event) => {
                    event.preventDefault();
                    router.push(
                      `/plans?title=${encodeURIComponent(idea.title)}&duration=${idea.duration}`,
                    );
                    setEditing(undefined);
                    setForm(true);
                  }}
                >
                  {idea.title}
                  <span>{idea.duration} min</span>
                </a>
              ))}
            <a className="quiet" href="/activities">
              Browse activities
            </a>
          </section>
        </aside>
      </div>
      {form && (
        <PlanDialog title={editing ? "Edit plan" : "New plan"} onClose={close}>
          <PlanForm
            key={`${editing?.id || "new"}-${params.get("title") || ""}-${suggestedTime || ""}`}
            members={space.members}
            me={space.me}
            initial={editing}
            suggestedTime={suggestedTime}
            suggestedTitle={params.get("title") || ""}
            suggestedDuration={
              Number.isFinite(duration) && duration >= 5 && duration <= 1440
                ? duration
                : 30
            }
            onClose={close}
          />
        </PlanDialog>
      )}
    </div>
  );
}

function PlanDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    element?.showModal();
    return () => {
      element?.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="plan-form-container panel"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      {children}
    </dialog>
  );
}
