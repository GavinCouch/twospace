// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import { ProfileSettings } from "../../src/features/settings/profile-settings";
import { SpaceSettings } from "../../src/features/settings/space-settings";
import type { Person } from "../../src/shared/types";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/components/space-provider", () => ({
  useAction: () => ({ run: request, pending: false, error: null }),
}));
const person = {
  id: "alex",
  name: "Alex",
  timeZone: "America/Chicago",
  color: "#293b80",
  availableFrom: 17,
  availableTo: 22,
};
beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({ ok: true });
});
afterEach(cleanup);
function renderProfile(profile: Person = person) {
  const client = new QueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <ProfileSettings person={profile} />
    </QueryClientProvider>,
  );
  return {
    ...view,
    rerenderProfile: (nextPerson: Person) =>
      view.rerender(
        <QueryClientProvider client={client}>
          <ProfileSettings person={nextPerson} />
        </QueryClientProvider>,
      ),
  };
}

describe("profile and space settings", () => {
  it("previews an accent immediately and keeps it while the saved snapshot catches up", async () => {
    const user = userEvent.setup();
    const view = renderProfile();
    const avatar = view.container.querySelector(".settings-avatar")!;
    await user.click(screen.getByRole("radio", { name: "Berry" }));
    expect(screen.getByRole("radio", { name: "Berry" })).toBeChecked();
    expect(avatar).toHaveStyle({ "--avatar-accent": "#8c526b" });
    expect(request).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Profile saved",
    );
    expect(request).toHaveBeenCalledWith(
      "/api/profile",
      expect.objectContaining({ color: "#8c526b" }),
      "PATCH",
    );
    view.rerenderProfile({ ...person });
    expect(screen.getByRole("radio", { name: "Berry" })).toBeChecked();
    expect(avatar).toHaveStyle({ "--avatar-accent": "#8c526b" });
    expect(screen.getByRole("button", { name: "Save profile" })).toBeDisabled();

    view.rerenderProfile({ ...person, color: "#8c526b" });
    expect(screen.getByRole("radio", { name: "Berry" })).toBeChecked();
    expect(avatar).toHaveStyle({ "--avatar-accent": "#8c526b" });
  });
  it("changes the accent without replacing an uploaded profile photo", async () => {
    const user = userEvent.setup();
    const profile = { ...person, avatarMediaId: "profile-photo" };
    const view = renderProfile(profile);
    const avatar = view.container.querySelector(".settings-avatar")!;
    const photo = avatar.querySelector("img")!;
    expect(new URL(photo.src).pathname).toBe("/api/media/profile-photo");

    await user.click(screen.getByRole("radio", { name: "Orange" }));
    expect(avatar).toHaveStyle({ "--avatar-accent": "#df714b" });
    expect(avatar.querySelector("img")).toBe(photo);
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Profile saved",
    );
    expect(request).toHaveBeenCalledWith(
      "/api/profile",
      expect.objectContaining({ color: "#df714b" }),
      "PATCH",
    );

    view.rerenderProfile({ ...profile, color: "#df714b" });
    expect(new URL(avatar.querySelector("img")!.src).pathname).toBe(
      "/api/media/profile-photo",
    );
    expect(
      screen.getByRole("button", { name: "Change photo" }),
    ).toBeInTheDocument();
    expect(avatar).toHaveStyle({ "--avatar-accent": "#df714b" });
  });
  it("does not revert a saved profile while the previous server snapshot is still displayed", async () => {
    const user = userEvent.setup();
    renderProfile();
    const name = screen.getByRole("textbox", { name: "Name" });
    await user.clear(name);
    await user.type(name, "Morgan");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Profile saved",
    );
    expect(name).toHaveValue("Morgan");
    expect(request).toHaveBeenCalledWith(
      "/api/profile",
      expect.objectContaining({ name: "Morgan" }),
      "PATCH",
    );
  });
  it("rejects an invalid city time zone before sending changes", async () => {
    const user = userEvent.setup();
    renderProfile();
    const zone = screen.getByRole("combobox", { name: "Time zone" });
    await user.clear(zone);
    await user.type(zone, "Not/A_Time_Zone");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(
      await screen.findByText("Choose a valid city time zone."),
    ).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });
  it("supports usual free hours that continue past midnight", async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "From" }),
      "22",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Until" }),
      "2",
    );
    expect(screen.getByText(/Ends the following day/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    expect(request).toHaveBeenCalledWith(
      "/api/profile",
      expect.objectContaining({ availableFrom: 22, availableTo: 2 }),
      "PATCH",
    );
  });
  it("keeps the saved space name until a new server name arrives", async () => {
    const user = userEvent.setup();
    render(<SpaceSettings name="Our space" />);
    const name = screen.getByRole("textbox", { name: "Space name" });
    await user.clear(name);
    await user.type(name, "Sunday club");
    await user.click(screen.getByRole("button", { name: "Save space name" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Space name saved",
    );
    expect(name).toHaveValue("Sunday club");
  });
});
