// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpaceClock } from "@/components/space-clock";

const person = {
  id: "one",
  name: "Alex",
  timeZone: "America/Chicago",
  color: "rose",
  availableFrom: 18,
  availableTo: 22,
};
let reduced = false;
let hidden = false;
let preferenceListeners: Set<() => void>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-15T12:34:56Z"));
  reduced = false;
  hidden = false;
  preferenceListeners = new Set();
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return reduced;
    },
    addEventListener: (_event: string, callback: () => void) =>
      preferenceListeners.add(callback),
    removeEventListener: (_event: string, callback: () => void) =>
      preferenceListeners.delete(callback),
  }));
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("shared-space clocks", () => {
  it("shows each person's local time rather than the browser's zone", () => {
    const { container } = render(
      <>
        <SpaceClock person={person} />
        <SpaceClock
          person={{
            ...person,
            id: "two",
            name: "Jamie",
            timeZone: "Europe/London",
          }}
        />
      </>,
    );
    expect(screen.getByText("6:34 AM")).toBeDefined();
    expect(screen.getByText("12:34 PM")).toBeDefined();
    expect(
      container.querySelectorAll('.clock-dial[data-period="night"]'),
    ).toHaveLength(1);
    expect(
      container.querySelectorAll('.clock-dial[data-period="day"]'),
    ).toHaveLength(1);
  });

  it("pauses in the background and catches up on return", () => {
    const { container, unmount } = render(<SpaceClock person={person} />);
    const dial = container.querySelector<HTMLElement>(".clock-dial")!;
    expect(vi.getTimerCount()).toBe(1);
    act(() => {
      hidden = true;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(10_000));
    expect(dial.style.getPropertyValue("--second-angle")).toBe("336deg");
    act(() => {
      hidden = false;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(dial.style.getPropertyValue("--second-angle")).toBe("36deg");
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(preferenceListeners.size).toBe(0);
  });

  it("slows updates immediately when reduced motion is enabled", () => {
    const { container } = render(<SpaceClock person={person} />);
    const dial = container.querySelector<HTMLElement>(".clock-dial")!;
    act(() => {
      reduced = true;
      preferenceListeners.forEach((callback) => callback());
    });
    act(() => vi.advanceTimersByTime(2000));
    expect(dial.style.getPropertyValue("--second-angle")).toBe("336deg");
    act(() => vi.advanceTimersByTime(28_000));
    expect(screen.getByText("6:35 AM")).toBeDefined();
  });
});
