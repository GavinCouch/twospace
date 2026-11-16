import { Temporal } from "@js-temporal/polyfill";

export function planCountdown(startsAt: string, timeZone: string, now: Date) {
  try {
    const today = Temporal.Instant.fromEpochMilliseconds(now.getTime())
      .toZonedDateTimeISO(timeZone)
      .toPlainDate();
    const target = Temporal.Instant.from(startsAt)
      .toZonedDateTimeISO(timeZone)
      .toPlainDate();
    const days = today.until(target, { largestUnit: "days" }).days;
    if (days < 0) return "Earlier";
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days <= 30) return `In ${days} days`;
    return `In ${Math.round(days / 7)}w`;
  } catch {
    return null;
  }
}
