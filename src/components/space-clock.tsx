"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Person } from "@/shared/types";

export function SpaceClock({ person }: { person: Person }) {
  const [now, setNow] = useState<Date | null>(null);
  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: person.timeZone,
      }),
    [person.timeZone],
  );
  const dialFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en", {
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hourCycle: "h23",
        timeZone: person.timeZone,
      }),
    [person.timeZone],
  );

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval> | undefined;
    function resume() {
      clearInterval(timer);
      if (!document.hidden) {
        setNow(new Date());
        timer = setInterval(
          () => setNow(new Date()),
          reduced.matches ? 30_000 : 1000,
        );
      }
    }
    resume();
    document.addEventListener("visibilitychange", resume);
    reduced.addEventListener("change", resume);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      reduced.removeEventListener("change", resume);
    };
  }, []);

  const parts = now
    ? Object.fromEntries(
        dialFormatter.formatToParts(now).map((part) => [part.type, part.value]),
      )
    : {};
  const hour = Number(parts.hour ?? 12),
    minute = Number(parts.minute ?? 0),
    second = Number(parts.second ?? 0);
  return (
    <div className="partner-clock">
      <span
        className="clock-dial"
        aria-hidden="true"
        data-period={hour >= 7 && hour < 19 ? "day" : "night"}
        style={
          {
            "--hour-angle": `${hour * 30 + minute / 2}deg`,
            "--minute-angle": `${minute * 6}deg`,
            "--second-angle": `${second * 6}deg`,
          } as CSSProperties
        }
      >
        <i className="clock-hand clock-hour" />
        <i className="clock-hand clock-minute" />
        <i className="clock-hand clock-second" />
      </span>
      <span className="clock-caption">
        <strong>
          <time dateTime={now?.toISOString()}>
            {now ? formatter.format(now) : "—"}
          </time>
        </strong>
        <small>
          {person.name} ·{" "}
          {person.timeZone.split("/").at(-1)?.replaceAll("_", " ")}
        </small>
      </span>
    </div>
  );
}
