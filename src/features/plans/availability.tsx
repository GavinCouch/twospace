"use client";
import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { dateTimeInZone, formatInZone, localToInstant } from "@/shared/time";
import type { Person } from "@/shared/types";

export function Availability({
  members,
  me,
  onChoose,
}: {
  members: Person[];
  me: Person;
  onChoose: (instant: string) => void;
}) {
  const [date, setDate] = useState(() =>
    dateTimeInZone(new Date().toISOString(), me.timeZone).slice(0, 10),
  );
  const [hour, setHour] = useState(18);
  const instantAt = (h: number) => {
    try {
      return localToInstant(
        `${date}T${String(h).padStart(2, "0")}:00`,
        me.timeZone,
      );
    } catch {
      return null;
    }
  };
  const instant = instantAt(hour);
  function available(member: Person, at: string | null) {
    if (!at) return false;
    const localHour = Number(dateTimeInZone(at, member.timeZone).slice(11, 13));
    return member.availableFrom <= member.availableTo
      ? localHour >= member.availableFrom && localHour < member.availableTo
      : localHour >= member.availableFrom || localHour < member.availableTo;
  }
  const sharedHours = Array.from({ length: 24 }, (_, h) => h).filter((h) => {
    const at = instantAt(h);
    return (
      members.length === 2 && members.every((member) => available(member, at))
    );
  });
  const nextSharedHour =
    sharedHours.find((h) => h > hour) ?? sharedHours[0] ?? null;
  return (
    <section className="availability panel">
      <div className="row spread wrap">
        <h2>
          <CalendarClock size={18} />
          Find a time
        </h2>
        <label className="field">
          <span className="sr-only">Day to compare</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
      </div>
      <p className="muted small">
        Shaded hours are the usual free hours each person chose in Settings.
      </p>
      {members.map((member) => (
        <div className="availability-person" key={member.id}>
          <div className="row spread">
            <strong>{member.name}</strong>
            <span>
              {instant
                ? formatInZone(instant, member.timeZone)
                : "Choose another hour"}
            </span>
          </div>
          <div className="hour-track">
            {Array.from({ length: 24 }, (_, h) => {
              const at = instantAt(h);
              const free = available(member, at);
              const label = at
                ? `${formatInZone(at, member.timeZone)}: ${free ? "free" : "busy"}`
                : "unavailable time";
              return (
                <button
                  key={h}
                  type="button"
                  aria-label={`${member.name}: ${label}`}
                  aria-pressed={hour === h}
                  disabled={!at}
                  className={`hour-slot${free ? " available" : ""}${hour === h ? " chosen" : ""}`}
                  onClick={() => setHour(h)}
                />
              );
            })}
          </div>
        </div>
      ))}
      <label className="time-slider">
        <span>
          Time in {me.timeZone.split("/").at(-1)?.replaceAll("_", " ")}
        </span>
        <input
          type="range"
          min={0}
          max={23}
          value={hour}
          onChange={(e) => setHour(Number(e.target.value))}
          aria-valuetext={`${hour}:00`}
        />
        <span className="slider-labels">
          <span>Midnight</span>
          <span>Noon</span>
          <span>11 pm</span>
        </span>
      </label>
      <div className="row spread wrap">
        <span className="muted small" aria-live="polite">
          {instant &&
          members.length === 2 &&
          members.every((member) => available(member, instant))
            ? "Inside both of your usual free hours"
            : "You can still suggest this time"}
        </span>
        <div className="row wrap">
          {nextSharedHour !== null && (
            <button
              type="button"
              className="quiet"
              onClick={() => setHour(nextSharedHour)}
            >
              Next shared hour
            </button>
          )}
          <button
            className="secondary"
            disabled={!instant}
            onClick={() => instant && onChoose(instant)}
          >
            Use this time
          </button>
        </div>
      </div>
    </section>
  );
}
