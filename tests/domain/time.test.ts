import { describe, expect, it } from "vitest";
import {
  dateTimeInZone,
  localDateInZone,
  localToInstant,
  partnerTimeOffset,
} from "../../src/shared/time";

describe("time-zone scheduling", () => {
  it("represents one instant on different local dates", () => {
    const instant = localToInstant("2026-11-20T20:00", "America/Chicago");
    expect(instant).toBe("2026-11-21T02:00:00Z");
    expect(dateTimeInZone(instant, "Asia/Tokyo")).toBe("2026-11-21T11:00");
    expect(localDateInZone(instant, "America/Chicago")).toBe("2026-11-20");
  });
  it("rejects nonexistent spring-forward and repeated fall-back times", () => {
    expect(() => localToInstant("2026-03-08T02:30", "America/New_York")).toThrow("clocks change");
    expect(() => localToInstant("2026-11-01T01:30", "America/New_York")).toThrow("clocks change");
  });
  it("keeps an ordinary local time stable across a round trip", () => {
    for (const zone of ["Europe/London", "Asia/Kathmandu", "Australia/Sydney"]) {
      expect(dateTimeInZone(localToInstant("2026-07-10T18:15", zone), zone)).toBe("2026-07-10T18:15");
    }
  });
  it("rejects impossible dates and input that already contains an offset", () => {
    expect(() => localToInstant("2026-02-30T12:00", "UTC")).toThrow();
    expect(() => localToInstant("2026-11-20T12:00Z", "UTC")).toThrow();
  });
  it("formats the time offset between partners across standard and half-hour zones", () => {
    const at = new Date("2026-11-15T18:00:00Z");
    expect(partnerTimeOffset("America/Chicago", "America/Chicago", at)).toBe(
      "Same time zone",
    );
    expect(partnerTimeOffset("Europe/London", "UTC", at)).toBe("Same time");
    expect(partnerTimeOffset("America/Chicago", "Europe/London", at)).toBe(
      "6h ahead",
    );
    expect(partnerTimeOffset("Europe/London", "America/Chicago", at)).toBe(
      "6h behind",
    );
    expect(partnerTimeOffset("Europe/London", "Asia/Kolkata", at)).toBe(
      "5h 30m ahead",
    );
    expect(partnerTimeOffset("America/Chicago", "Not/A_Zone", at)).toBeNull();
  });
});
