"use client";

import { useId, useRef, useState, type PointerEvent } from "react";
import { Pencil, Circle, Square, Minus, Keyboard } from "lucide-react";
import { canvasPoint, DRAWING_COLORS, DRAWING_HEIGHT, DRAWING_WIDTH, keyboardStamp, strokePath } from "@/shared/drawing";
import type { Stroke } from "@/shared/types";

export type NewStroke = Omit<Stroke, "authorId">;
const toolOptions = [{ id: "pen", label: "Pen", Icon: Pencil }, { id: "line", label: "Line", Icon: Minus }, { id: "circle", label: "Circle", Icon: Circle }, { id: "square", label: "Rectangle", Icon: Square }] as const;
const colorNames = ["Ink", "Teal", "Coral", "Blue", "Gold"];
const positions = ["Top left", "Top middle", "Top right", "Middle left", "Center", "Middle right", "Bottom left", "Bottom middle", "Bottom right"];

export function DrawingSurface({ strokes, caption, disabled, pendingStroke, onStroke }: {
  strokes: Stroke[]; caption: string; disabled: boolean; pendingStroke: NewStroke | null; onStroke: (stroke: NewStroke) => void;
}) {
  const [tool, setTool] = useState<Stroke["tool"]>("pen");
  const [color, setColor] = useState(DRAWING_COLORS[0]);
  const [width, setWidth] = useState(4);
  const [preview, setPreview] = useState<NewStroke | null>(null);
  const [stampTool, setStampTool] = useState<"circle" | "square" | "line">("circle");
  const [stampPosition, setStampPosition] = useState(4);
  const pointer = useRef<{ id: number; stroke: NewStroke } | null>(null);
  const descriptionId = useId();
  function start(event: PointerEvent<SVGSVGElement>) {
    if (disabled || pointer.current || event.button !== 0) return;
    event.preventDefault();
    const stroke: NewStroke = { id: crypto.randomUUID(), tool, color, width, points: [canvasPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect())] };
    pointer.current = { id: event.pointerId, stroke };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPreview(stroke);
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    if (!pointer.current || pointer.current.id !== event.pointerId) return;
    const point = canvasPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    const current = pointer.current.stroke;
    const points = current.tool === "pen" ? [...current.points.slice(0, 998), point] : [current.points[0], point];
    pointer.current.stroke = { ...current, points };
    setPreview(pointer.current.stroke);
  }
  function finish(event: PointerEvent<SVGSVGElement>) {
    if (!pointer.current || pointer.current.id !== event.pointerId) return;
    const stroke = pointer.current.stroke;
    pointer.current = null; setPreview(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
    onStroke(stroke);
  }
  function cancel(event: PointerEvent<SVGSVGElement>) {
    if (pointer.current?.id === event.pointerId) { pointer.current = null; setPreview(null); }
  }
  const draft = preview || pendingStroke;
  return <div className="drawing-workspace">
    <div className="drawing-tools">
      <div className="drawing-tool-group" aria-label="Drawing tool">{toolOptions.map(({ id, label, Icon }) => <button key={id} className={`quiet drawing-tool${tool === id ? " selected" : ""}`} type="button" aria-pressed={tool === id} aria-label={label} title={label} disabled={disabled} onClick={() => setTool(id)}><Icon size={20} aria-hidden="true" /><span>{label}</span></button>)}</div>
      <div className="drawing-colors" aria-label="Ink color">{DRAWING_COLORS.map((value, index) => <button key={value} type="button" className={`color-swatch${color === value ? " selected" : ""}`} style={{ "--swatch": value } as React.CSSProperties} aria-pressed={color === value} aria-label={colorNames[index]} disabled={disabled} onClick={() => setColor(value)} />)}</div>
      <label className="drawing-width">Width<select value={width} disabled={disabled} onChange={event => setWidth(Number(event.target.value))}><option value={2}>Fine</option><option value={4}>Medium</option><option value={8}>Bold</option><option value={12}>Thick</option></select></label>
    </div>
    <div className={`drawing-canvas-wrap${disabled ? " drawing-readonly" : ""}`}>
      <svg className="drawing-canvas" viewBox={`0 0 ${DRAWING_WIDTH} ${DRAWING_HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={caption || "Shared drawing"} aria-describedby={descriptionId} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel}>
        {strokes.map(stroke => <path key={stroke.id} d={strokePath(stroke)} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" />)}
        {draft && <path d={strokePath(draft)} fill="none" stroke={draft.color} strokeWidth={draft.width} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />}
      </svg>
      {!strokes.length && !draft && <span className="canvas-empty-hint" aria-hidden="true">Start with a line, a shape, anything.</span>}
    </div>
    <p id={descriptionId} className="muted small-copy">{disabled ? "The drawing is view-only while it is your partner’s turn or a change is saving." : "Draw with a mouse, pen or touch. Keyboard controls below can add shapes without dragging."}</p>
    <details className="keyboard-drawing"><summary><Keyboard size={17} aria-hidden="true" />Add a shape with the keyboard</summary><div className="keyboard-stamp-controls"><label className="field">Shape<select value={stampTool} disabled={disabled} onChange={event => setStampTool(event.target.value as typeof stampTool)}><option value="circle">Circle</option><option value="square">Square</option><option value="line">Diagonal line</option></select></label><label className="field">Position<select value={stampPosition} disabled={disabled} onChange={event => setStampPosition(Number(event.target.value))}>{positions.map((position, index) => <option key={position} value={index}>{position}</option>)}</select></label><button type="button" className="secondary" disabled={disabled} onClick={() => onStroke({ id: crypto.randomUUID(), tool: stampTool, color, width, points: keyboardStamp(stampTool, stampPosition) })}>Add shape</button></div></details>
  </div>;
}
