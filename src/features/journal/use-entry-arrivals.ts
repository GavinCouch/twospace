"use client";

import { useEffect, useRef, useState } from "react";
import type { Entry } from "@/shared/types";

/** Track server additions, independently of filters and repeated polling. */
export function useEntryArrivals(entries: Entry[] | undefined, scope: string) {
  const seen = useRef<{ scope: string; ids: Set<string> } | null>(null);
  const [arrivals, setArrivals] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!entries) return;
    if (!seen.current || seen.current.scope !== scope) {
      seen.current = { scope, ids: new Set(entries.map(entry => entry.id)) };
      setArrivals(new Set());
      return;
    }

    const seenIds = seen.current.ids;
    const added = entries.filter(entry => !seenIds.has(entry.id));
    for (const entry of added) seenIds.add(entry.id);
    if (added.length) {
      setArrivals(current => new Set([...current, ...added.map(entry => entry.id)]));
    }
  }, [entries, scope]);

  useEffect(() => {
    if (!arrivals.size) return;
    const timeout = window.setTimeout(() => setArrivals(new Set()), 650);
    return () => window.clearTimeout(timeout);
  }, [arrivals]);

  return arrivals;
}
