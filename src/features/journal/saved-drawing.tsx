import type { Stroke } from "@/shared/types";
import { DRAWING_HEIGHT, DRAWING_WIDTH, strokePath } from "@/shared/drawing";

export function SavedDrawing({ strokes, caption }: { strokes: Stroke[]; caption: string }) {
  return <svg className="journal-drawing" viewBox={`0 0 ${DRAWING_WIDTH} ${DRAWING_HEIGHT}`} role="img" aria-label={caption || "A shared drawing"}>
    <rect width={DRAWING_WIDTH} height={DRAWING_HEIGHT} fill="#ffffff" />
    {strokes.map(stroke => <path key={stroke.id} d={strokePath(stroke)} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" />)}
  </svg>;
}
