import { Temporal } from "@js-temporal/polyfill";

/** A wall-clock choice is rejected when DST makes it missing or ambiguous. */
export function localToInstant(localDateTime: string, timeZone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(localDateTime)) {
    throw new Error("Choose a date and time.");
  }
  try {
    return Temporal.PlainDateTime.from(localDateTime, { overflow: "reject" })
      .toZonedDateTime(timeZone, { disambiguation: "reject" }).toInstant().toString();
  } catch {
    throw new Error("That local time is invalid or occurs twice when the clocks change. Choose another time and check the time zone.");
  }
}

export function dateTimeInZone(instant: string, timeZone: string): string {
  return Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone)
    .toPlainDateTime().toString({ smallestUnit: "minute" });
}

export function formatInZone(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone, timeZoneName: "short",
  }).format(new Date(instant));
}

export function localDateInZone(instant: string, timeZone: string): string {
  return Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone).toPlainDate().toString();
}
