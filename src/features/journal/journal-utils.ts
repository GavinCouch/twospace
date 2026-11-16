import { z } from "zod";
import type { Entry, EntryKind } from "@/shared/types";

export const entryKindLabels: Record<EntryKind, string> = {
  note: "Note",
  photo: "Photo",
  link: "Link",
  voice: "Voice note",
  drawing: "Drawing",
  memory: "Memory",
};

export function safeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function linkLabel(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "Open link";
  }
}

export function entrySummary(entry: Entry): string {
  if (entry.locked) return "A note for later";
  return entry.title || entry.body.slice(0, 72) || entryKindLabels[entry.kind];
}

export function entryDate(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

export function groupJournalDays(entries: Entry[], timeZone: string) {
  const dateKey = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  });
  const dateLabel = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
  const weekday = new Intl.DateTimeFormat("en", { weekday: "long", timeZone });
  const days = new Map<
    string,
    { key: string; label: string; weekday: string; entries: Entry[] }
  >();
  for (const entry of [...entries].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  )) {
    const date = new Date(entry.createdAt);
    const key = dateKey.format(date);
    const group = days.get(key);
    if (group) group.entries.push(entry);
    else
      days.set(key, {
        key,
        label: dateLabel.format(date),
        weekday: weekday.format(date),
        entries: [entry],
      });
  }
  return [...days.values()];
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}

export const noteSchema = z.object({
  body: z.string().max(6000, "Keep this note under 6,000 characters."),
  title: z.string().max(120, "Keep the title under 120 characters."),
  collection: z
    .string()
    .max(40, "Keep the collection name under 40 characters."),
});
export type NoteValues = z.infer<typeof noteSchema>;

export function filterEntries(
  entries: Entry[],
  options: {
    query: string;
    collection: string;
    pinned: boolean;
    kind?: EntryKind | "";
  },
): Entry[] {
  const query = options.query.trim().toLocaleLowerCase();
  return entries
    .filter((entry) => {
      if (options.pinned && !entry.pinned) return false;
      if (options.kind && entry.kind !== options.kind) return false;
      if (options.collection && entry.collection !== options.collection)
        return false;
      if (!query) return true;
      if (entry.locked) return false;
      return [
        entry.title,
        entry.body,
        entry.collection,
        entryKindLabels[entry.kind],
      ].some((value) => value.toLocaleLowerCase().includes(query));
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
