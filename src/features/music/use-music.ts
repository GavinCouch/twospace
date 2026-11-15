"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/components/space-provider";
import type { MusicSnapshot } from "@/shared/music";
import type { SpaceSnapshot } from "@/shared/types";

export function useMusic(space?: SpaceSnapshot) {
  return useQuery({
    queryKey: ["space", "music", space?.space.id, space?.me.id],
    queryFn: () => api<MusicSnapshot>("/api/music"),
    enabled: !!space,
    refetchInterval: 4000,
    refetchIntervalInBackground: false,
  });
}

export function useMusicNow() {
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    const update = () => {
      if (!document.hidden) setNow(new Date().toISOString());
    };
    const interval = window.setInterval(update, 15_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return now;
}

export function songDate(day: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}
