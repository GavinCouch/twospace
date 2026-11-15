import type { Point, Stroke } from "./types";

export const DRAWING_WIDTH = 800;
export const DRAWING_HEIGHT = 500;
export const DRAWING_COLORS = ["#26313c", "#245c55", "#d78069", "#6b78a4", "#c4a359"];

export function canvasPoint(x: number, y: number, rect: { left: number; top: number; width: number; height: number }): Point {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return {
    x: Math.max(0, Math.min(DRAWING_WIDTH, (x - rect.left) / rect.width * DRAWING_WIDTH)),
    y: Math.max(0, Math.min(DRAWING_HEIGHT, (y - rect.top) / rect.height * DRAWING_HEIGHT)),
  };
}

export function strokePath(stroke: Pick<Stroke, "tool" | "points">): string {
  if (!stroke.points.length || stroke.points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return "";
  const n = (value: number) => Number(value.toFixed(2));
  const start = stroke.points[0];
  const end = stroke.points[stroke.points.length - 1];
  if (stroke.tool === "circle") {
    const radius = n(Math.hypot(end.x - start.x, end.y - start.y));
    if (!radius) return `M ${n(start.x)} ${n(start.y)} l 0.01 0`;
    return `M ${n(start.x - radius)} ${n(start.y)} a ${radius} ${radius} 0 1 0 ${radius * 2} 0 a ${radius} ${radius} 0 1 0 ${-radius * 2} 0`;
  }
  if (stroke.tool === "square") return `M ${n(start.x)} ${n(start.y)} H ${n(end.x)} V ${n(end.y)} H ${n(start.x)} Z`;
  if (stroke.tool === "line") return `M ${n(start.x)} ${n(start.y)} L ${n(end.x)} ${n(end.y)}`;
  if (stroke.points.length === 1) return `M ${n(start.x)} ${n(start.y)} l 0.01 0`;
  return stroke.points.map((point, index) => `${index ? "L" : "M"} ${n(point.x)} ${n(point.y)}`).join(" ");
}

export function keyboardStamp(tool: "circle" | "square" | "line", position: number): Point[] {
  if (!Number.isInteger(position) || position < 0 || position > 8) throw new Error("Choose one of the nine canvas positions.");
  const x = (position % 3 + 1) * DRAWING_WIDTH / 4;
  const y = (Math.floor(position / 3) + 1) * DRAWING_HEIGHT / 4;
  return tool === "circle" ? [{ x, y }, { x: x + 35, y }] : [{ x: x - 35, y: y - 35 }, { x: x + 35, y: y + 35 }];
}
