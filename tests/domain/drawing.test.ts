import { describe, expect, it } from "vitest";
import { canvasPoint, keyboardStamp, strokePath } from "../../src/shared/drawing";

describe("shared canvas coordinates", () => {
  it("maps a scaled canvas into the same stored coordinates and clamps captured pointers", () => {
    const rect = { left: 20, top: 30, width: 400, height: 250 };
    expect(canvasPoint(220, 155, rect)).toEqual({ x: 400, y: 250 });
    expect(canvasPoint(-10, 500, rect)).toEqual({ x: 0, y: 500 });
  });
  it("keeps a single pen click visible and refuses non-finite points", () => {
    expect(strokePath({ tool: "pen", points: [{ x: 10, y: 20 }] })).toContain("l 0.01 0");
    expect(strokePath({ tool: "pen", points: [{ x: NaN, y: 0 }] })).toBe("");
  });
  it("places keyboard stamps at predictable positions without pointer input", () => {
    expect(keyboardStamp("circle", 4)[0]).toEqual({ x: 400, y: 250 });
    expect(keyboardStamp("square", 0)).toEqual([{ x: 165, y: 90 }, { x: 235, y: 160 }]);
    expect(() => keyboardStamp("line", 9)).toThrow();
  });
  it("uses the final pointer for shapes instead of leaving a freehand trail", () => {
    const points = [{ x: 10, y: 20 }, { x: 80, y: 90 }, { x: 30, y: 40 }];
    expect(strokePath({ tool: "line", points })).toBe("M 10 20 L 30 40");
    expect(strokePath({ tool: "square", points })).toBe("M 10 20 H 30 V 40 H 10 Z");
  });
});
