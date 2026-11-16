"use client";

import {
  useEffect,
  useId,
  useRef,
  type PointerEvent,
  type ReactNode,
} from "react";
import { X } from "lucide-react";

function isOutsideDialog(event: PointerEvent<HTMLDialogElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  return (
    event.target === event.currentTarget &&
    (event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom)
  );
}

export function JournalDialog({
  title,
  children,
  onClose,
  busy = false,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const backdropPointer = useRef<number | null>(null);
  const titleId = useId();
  useEffect(() => {
    const active =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const closedMenu = active?.closest("details:not([open])");
    const opener = closedMenu?.querySelector("summary") || active;
    const element = dialog.current;
    element?.showModal();
    element?.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    return () => {
      element?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className={`journal-dialog${wide ? " journal-dialog-wide" : ""}`}
      aria-labelledby={titleId}
      onPointerDown={(event) => {
        backdropPointer.current =
          !busy && event.button === 0 && isOutsideDialog(event)
            ? event.pointerId
            : null;
      }}
      onPointerUp={(event) => {
        const startedOutside = backdropPointer.current === event.pointerId;
        backdropPointer.current = null;
        if (!busy && startedOutside && isOutsideDialog(event)) onClose();
      }}
      onPointerCancel={() => {
        backdropPointer.current = null;
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="journal-dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          className="quiet journal-icon-button"
          type="button"
          aria-label="Close"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
