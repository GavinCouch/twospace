// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import type { SpaceSnapshot } from "@/shared/types";

const view = vi.hoisted(() => ({
  data: undefined as SpaceSnapshot | undefined,
  path: "/journal",
}));
vi.mock("next/navigation", () => ({ usePathname: () => view.path }));
vi.mock("@/components/space-provider", async (original) => ({
  ...(await original<typeof import("@/components/space-provider")>()),
  useSpace: () => ({
    data: view.data,
    isPending: false,
    error: null,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/components/account-gate", () => ({
  Brand: () => <span>TwoSpace</span>,
}));
vi.mock("@/components/space-clock", () => ({ SpaceClock: () => null }));
vi.mock("@/components/section-art", () => ({ SectionArt: () => null }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
  useLinkStatus: () => ({ pending: false }),
}));
import { AppShell } from "@/components/app-shell";
const person = {
  id: "me",
  name: "Morgan",
  timeZone: "UTC",
  color: "#aabbcc",
  availableFrom: 18,
  availableTo: 22,
};
const space: SpaceSnapshot = {
  space: {
    id: "s",
    name: "Ours",
    createdAt: "2026-11-15",
    isDemo: false,
    canSwitch: true,
  },
  me: person,
  members: [person],
  entries: [],
  photoPairs: [],
  questions: [],
  games: [],
  drawings: [],
  ideas: [],
  plans: [],
};
afterEach(() => {
  cleanup();
  view.path = "/journal";
});

describe("shared feature gate", () => {
  it("does not mount a feature for a solo member and leaves Settings reachable", () => {
    view.data = space;
    const child = vi.fn(() => <div>Private journal</div>);
    const Child = child;
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AppShell>
          <Child />
        </AppShell>
      </QueryClientProvider>,
    );
    expect(child).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Invite your partner" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Settings" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("link", { name: "Activities" }),
    ).not.toBeInTheDocument();
  });
  it("unmounts an open feature when the partner leaves", () => {
    view.data = { ...space, members: [person, { ...person, id: "partner" }] };
    const client = new QueryClient();
    const page = (
      <QueryClientProvider client={client}>
        <AppShell>
          <div>Private journal</div>
        </AppShell>
      </QueryClientProvider>
    );
    const { rerender } = render(page);
    expect(screen.getByText("Private journal")).toBeInTheDocument();
    view.data = space;
    rerender(
      <QueryClientProvider client={client}>
        <AppShell>
          <div>Private journal</div>
        </AppShell>
      </QueryClientProvider>,
    );
    expect(screen.queryByText("Private journal")).not.toBeInTheDocument();
  });
  it("allows solo members to use account settings", () => {
    view.data = space;
    view.path = "/settings";
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AppShell>
          <div>Account settings</div>
        </AppShell>
      </QueryClientProvider>,
    );
    expect(screen.getByText("Account settings")).toBeInTheDocument();
  });
});
