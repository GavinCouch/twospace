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

/**
 * Human-readable offset comparison between two members at a given instant,
 * such as "Same time zone", "Same time", or "6h ahead".
 */
export function partnerTimeOffset(
  myTimeZone: string,
  partnerTimeZone: string,
  at: Date = new Date(),
): string | null {
  try {
    const instant = Temporal.Instant.fromEpochMilliseconds(at.getTime());
    const myOffset = instant.toZonedDateTimeISO(myTimeZone).offsetNanoseconds;
    const partnerOffset =
      instant.toZonedDateTimeISO(partnerTimeZone).offsetNanoseconds;
    const diffMinutes = Math.round((partnerOffset - myOffset) / 60_000_000_000);
    if (diffMinutes === 0) {
      return myTimeZone === partnerTimeZone ? "Same time zone" : "Same time";
    }
    const ahead = diffMinutes > 0;
    const abs = Math.abs(diffMinutes);
    const hours = Math.floor(abs / 60);
    const minutes = abs % 60;
    const amount = minutes ? `${hours}h ${minutes}m` : `${hours}h`;
    return `${amount} ${ahead ? "ahead" : "behind"}`;
  } catch {
    return null;
  }
}
