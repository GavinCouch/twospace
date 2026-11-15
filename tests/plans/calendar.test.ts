import { expect, it } from "vitest";
import { calendarFile } from "../../src/features/plans/calendar";
import type { Plan } from "../../src/shared/types";
it("exports one absolute event and escapes user text as calendar data", () => {
  const plan: Plan = {
    id: "test",
    title: "Dinner; then, games\nAt home",
    startsAt: "2026-11-20T23:30:00Z",
    duration: 90,
    timeZone: "America/Chicago",
    kind: "date",
    status: "accepted",
    proposedBy: "a",
    acceptedBy: ["a", "b"],
    notes: "Bring a snack",
    link: "",
    checklist: [],
  };
  const result = calendarFile(plan, new Date("2026-11-14T12:00:00Z"));
  expect(result).toContain(
    "DTSTART:20261120T233000Z\r\nDTEND:20261121T010000Z",
  );
  expect(result).toContain("SUMMARY:Dinner\\; then\\, games\\nAt home");
  expect(result.match(/BEGIN:VEVENT/g)).toHaveLength(1);
});
