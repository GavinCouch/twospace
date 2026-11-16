// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { ProductPreview } from "../../src/features/home/product-preview";

afterEach(cleanup);

describe("homepage product previews", () => {
  it("switches the screenshot, description, and full-size link together", async () => {
    const user = userEvent.setup();
    render(<ProductPreview />);
    await user.click(screen.getByRole("tab", { name: "Music" }));
    const panel = screen.getByRole("tabpanel", { name: "Music" });
    expect(
      within(panel).getByRole("heading", { name: "Pick a daily song" }),
    ).toBeInTheDocument();
    expect(within(panel).getByRole("img").getAttribute("src")).toContain(
      "music-desktop.jpg",
    );
    expect(
      within(panel)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual([
      "/screenshots/home/music-desktop.jpg",
      "/screenshots/home/music-mobile.jpg",
    ]);
    expect(
      screen.queryByRole("tabpanel", { name: "Journal" }),
    ).not.toBeInTheDocument();
  });

  it("supports arrow keys, Home, and End with one tab stop", async () => {
    const user = userEvent.setup();
    render(<ProductPreview />);
    screen.getByRole("tab", { name: "Journal" }).focus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Plans" })).toHaveFocus();
    expect(screen.getByRole("tabpanel", { name: "Plans" })).toBeInTheDocument();
    await user.keyboard("{Home}{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Activities" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Plans" })).toHaveFocus();
    expect(
      screen.getAllByRole("tab").filter((tab) => tab.tabIndex === 0),
    ).toHaveLength(1);
    for (const tab of screen.getAllByRole("tab")) {
      expect(
        document.getElementById(tab.getAttribute("aria-controls")!),
      ).toBeInTheDocument();
    }
  });
});
