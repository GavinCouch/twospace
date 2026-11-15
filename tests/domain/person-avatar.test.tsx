// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PersonAvatar } from "@/components/person-avatar";

afterEach(cleanup);

describe("default profile artwork", () => {
  it("keeps the same artwork when a person changes their name or accent", () => {
    const person = { id: "alex", name: "Alex", color: "#293b80" };
    const view = render(<PersonAvatar person={person} />);
    const original = view.container.querySelector("img")!.getAttribute("src");
    view.rerender(
      <PersonAvatar person={{ ...person, name: "Morgan", color: "#8c526b" }} />,
    );
    expect(view.container.querySelector("img")).toHaveAttribute(
      "src",
      original,
    );
    expect(view.container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("keeps a departed author’s artwork stable using their saved ID", () => {
    const view = render(
      <PersonAvatar
        person={{ id: "jamie", name: "Jamie", color: "#386b5c" }}
      />,
    );
    const original = view.container.querySelector("img")!.getAttribute("src");
    view.rerender(<PersonAvatar seed="jamie" />);
    expect(view.container.querySelector("img")).toHaveAttribute(
      "src",
      original,
    );
  });

  it("uses the person’s initial if the artwork fails to load", () => {
    const view = render(
      <PersonAvatar person={{ id: "alex", name: "Alex", color: "#293b80" }} />,
    );
    fireEvent.error(view.container.querySelector("img")!);
    expect(view.container.querySelector("img")).not.toBeInTheDocument();
    expect(
      view.container.querySelector(".person-avatar-fallback"),
    ).toHaveTextContent("A");
  });
});
