import type { Plan } from "@/shared/types";

const escapeText = (value: string) =>
  value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
const stamp = (value: Date) =>
  value
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}/, "");
export function calendarFile(plan: Plan, createdAt = new Date()): string {
  const start = new Date(plan.startsAt);
  const end = new Date(start.getTime() + plan.duration * 60000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TwoSpace//Shared plans//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${plan.id}@twospace.local`,
    `DTSTAMP:${stamp(createdAt)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeText(plan.title)}`,
    `DESCRIPTION:${escapeText([plan.notes, plan.link].filter(Boolean).join("\n"))}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
export function downloadCalendar(plan: Plan) {
  const url = URL.createObjectURL(
    new Blob([calendarFile(plan)], { type: "text/calendar;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "twospace-plan.ics";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
