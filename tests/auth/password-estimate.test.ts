import { describe, expect, it, vi } from "vitest";
import { estimatePassword } from "@/features/auth/password-estimate";

describe("local password estimates", () => {
  it("recognizes a common password even when it mixes character types", () => {
    const result = estimatePassword("Password123!", []);
    expect(result.score).toBeLessThan(3);
    expect(result.advice).not.toBe("");
  });
  it("uses personal words and never calls an external service", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const name = "GalvistonMerrivale";
      expect(estimatePassword(name, [name]).score).toBeLessThan(
        estimatePassword(name, []).score,
      );
      expect(
        estimatePassword("7h!Gx9sQp2Vm#6NzR8wF", []).score,
      ).toBeGreaterThanOrEqual(3);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
