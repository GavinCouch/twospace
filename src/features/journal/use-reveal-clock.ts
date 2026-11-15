import { useEffect, useState } from "react";
import type { Entry } from "@/shared/types";

export function useRevealClock(entries: Entry[] | undefined) {
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const revealTimes = (entries || [])
      .filter((entry) => entry.revealAt)
      .map((entry) => Date.parse(entry.revealAt!))
      .filter(Number.isFinite);

    function update() {
      const current = Date.now();
      setClock(current);
      const next = revealTimes
        .filter((time) => time > current)
        .sort((a, b) => a - b)[0];
      if (next !== undefined) {
        // Recheck long waits so wall-clock changes cannot leave a note stuck.
        timer = setTimeout(update, Math.min(next - current, 60_000));
      }
    }

    update();
    return () => clearTimeout(timer);
  }, [entries]);

  return clock;
}
