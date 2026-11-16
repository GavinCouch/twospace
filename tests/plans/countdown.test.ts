import { describe, expect, it } from "vitest";
import { planCountdown } from "../../src/features/plans/countdown";

describe("plan countdown dates", () => {
  it("does not call yesterday's plan Today shortly after local midnight", () => {
    const now = new Date("2026-11-16T06:15:00Z");
    const plan = "2026-11-16T05:30:00Z";
    expect(planCountdown(plan, "America/Chicago", now)).toBe("Earlier");
    expect(planCountdown(plan, "Europe/London", now)).toBe("Today");
  });

  it("uses calendar days through daylight-saving changes", () => {
    expect(
      planCountdown(
        "2026-03-09T04:30:00Z",
        "America/Chicago",
        new Date("2026-03-08T05:30:00Z"),
      ),
    ).toBe("Tomorrow");
  });
});
