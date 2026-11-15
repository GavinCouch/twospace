// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PersonAvatar } from "@/components/person-avatar";

afterEach(cleanup);

const person = { id: "morgan", name: "Morgan", color: "#293b80" };

describe("profile avatars", () => {
  it("updates the silhouette accent without needing another image to load", () => {
    const view = render(<PersonAvatar person={person} />);
    expect(view.container.querySelector("img")).not.toBeInTheDocument();
    expect(view.container.querySelector("svg")).toBeInTheDocument();
    expect(view.container.firstChild).toHaveStyle({
      "--avatar-accent": "#293b80",
    });
    view.rerender(<PersonAvatar person={{ ...person, color: "#8c526b" }} />);
    expect(view.container.firstChild).toHaveStyle({
      "--avatar-accent": "#8c526b",
    });
    expect(view.container.querySelector("img")).not.toBeInTheDocument();
  });

  it("uses a neutral silhouette for a missing person or invalid accent", () => {
    const view = render(<PersonAvatar />);
    expect(view.container.firstChild).toHaveStyle({
      "--avatar-accent": "#74797d",
    });
    expect(view.container.querySelector("svg")).toBeInTheDocument();
    view.rerender(<PersonAvatar person={{ ...person, color: "invalid" }} />);
    expect(view.container.firstChild).toHaveStyle({
      "--avatar-accent": "#74797d",
    });
    expect(view.container.firstChild).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the protected photo when its border accent changes", () => {
    const photoPerson = { ...person, avatarMediaId: "first-photo" };
    const view = render(<PersonAvatar person={photoPerson} />);
    const image = view.container.querySelector("img")!;
    expect(new URL(image.src).pathname).toBe("/api/media/first-photo");
    expect(image).toHaveAttribute("alt", "");
    expect(view.container.firstChild).toHaveAttribute("data-photo", "true");
    view.rerender(
      <PersonAvatar person={{ ...photoPerson, color: "#df714b" }} />,
    );
    expect(view.container.querySelector("img")).toBe(image);
    expect(view.container.firstChild).toHaveStyle({
      "--avatar-accent": "#df714b",
    });
  });

  it("falls back to the selected silhouette after a photo fails and accepts a replacement", () => {
    const photoPerson = { ...person, avatarMediaId: "first-photo" };
    const view = render(<PersonAvatar person={photoPerson} />);
    fireEvent.error(view.container.querySelector("img")!);
    expect(view.container.querySelector("img")).not.toBeInTheDocument();
    expect(view.container.querySelector("svg")).toBeInTheDocument();
    expect(view.container.firstChild).not.toHaveAttribute("data-photo");
    expect(view.container.firstChild).toHaveStyle({
      "--avatar-accent": person.color,
    });
    view.rerender(
      <PersonAvatar
        person={{ ...photoPerson, avatarMediaId: "replacement-photo" }}
      />,
    );
    expect(new URL(view.container.querySelector("img")!.src).pathname).toBe(
      "/api/media/replacement-photo",
    );
  });
});
