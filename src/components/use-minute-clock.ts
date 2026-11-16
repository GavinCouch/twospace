"use client";

import { useEffect, useState } from "react";

export function useMinuteClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function update() {
      clearTimeout(timer);
      if (document.hidden) return;
      const current = new Date();
      setNow(current);
      timer = setTimeout(update, 60_000 - (current.getTime() % 60_000));
    }
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return now;
}
