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
  function available(member: Person, instant: string | null) {
    if (!instant) return false;
    const localHour = Number(
      dateTimeInZone(instant, member.timeZone).slice(11, 13),
    );
    return member.availableFrom <= member.availableTo
      ? localHour >= member.availableFrom && localHour < member.availableTo
      : localHour >= member.availableFrom || localHour < member.availableTo;
  }
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
          <div className="hour-track" aria-hidden="true">
            {Array.from({ length: 24 }, (_, h) => (
              <span
                key={h}
                className={`${available(member, instantAt(h)) ? "available" : ""} ${hour === h ? "chosen" : ""}`}
              />
            ))}
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
        <button
          className="secondary"
          disabled={!instant}
          onClick={() => instant && onChoose(instant)}
        >
          Use this time
        </button>
      </div>
    </section>
  );
}
