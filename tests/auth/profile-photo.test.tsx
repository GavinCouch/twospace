// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import { ProfileSettings } from "@/features/settings/profile-settings";
import { ProfilePhotoEditor } from "@/features/settings/profile-photo-editor";

const image = vi.hoisted(() => ({
  prepare: vi.fn(),
  draw: vi.fn(),
  export: vi.fn(),
}));
vi.mock("@/features/settings/profile-photo-image", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/features/settings/profile-photo-image")
  >()),
  prepareProfilePhoto: image.prepare,
  drawProfileCrop: image.draw,
  exportProfileCrop: image.export,
}));
vi.mock("@/components/space-provider", () => ({
  useAction: () => ({ run: vi.fn(), pending: false, error: null }),
}));
const person = {
  id: "alex",
  name: "Alex",
  timeZone: "America/Chicago",
  color: "#293b80",
  availableFrom: 17,
  availableTo: 22,
};
const requests: FakeRequest[] = [];
class FakeRequest {
  status = 0;
  responseText = "";
  timeout = 0;
  upload: {
    onprogress?: (event: {
      lengthComputable: boolean;
      loaded: number;
      total: number;
    }) => void;
  } = {};
  onload?: () => void;
  onerror?: () => void;
  ontimeout?: () => void;
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();
  abort = vi.fn();
  constructor() {
    requests.push(this);
  }
  complete(status: number, body: unknown) {
    this.status = status;
    this.responseText = JSON.stringify(body);
    this.onload?.();
  }
}
const dispose = vi.fn();
let client: QueryClient;
function wrap({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  requests.length = 0;
  dispose.mockReset();
  image.prepare.mockReset();
  image.draw.mockReset();
  image.export.mockReset();
  image.prepare.mockResolvedValue({
    source: {},
    width: 1600,
    height: 900,
    dispose,
  });
  image.export.mockResolvedValue(
    new Blob(["cropped jpeg"], { type: "image/jpeg" }),
  );
  vi.stubGlobal("XMLHttpRequest", FakeRequest);
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
});

describe("profile photo editing", () => {
  it("keeps the crop after an upload failure and preserves unsaved profile fields after success", async () => {
    const user = userEvent.setup();
    const view = render(<ProfileSettings person={person} />, { wrapper: wrap });
    const name = screen.getByRole("textbox", { name: "Name" });
    await user.clear(name);
    await user.type(name, "Morgan");
    await user.upload(
      screen.getByLabelText("Choose profile photo"),
      new File(["png"], "photo.png", { type: "image/png" }),
    );
    const zoom = await screen.findByRole("slider", { name: /Zoom/ });
    fireEvent.change(zoom, { target: { value: "1.5" } });
    await user.click(screen.getByRole("button", { name: "Save photo" }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].open).toHaveBeenCalledWith("PUT", "/api/profile/photo");
    expect(requests[0].setRequestHeader).toHaveBeenCalledWith(
      "Content-Type",
      "image/jpeg",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await act(async () => requests[0].complete(500, { error: "Try again." }));
    expect(screen.getByRole("alert")).toHaveTextContent("Try again.");
    expect(zoom).toHaveValue("1.5");
    await user.click(screen.getByRole("button", { name: "Save photo" }));
    await waitFor(() => expect(requests).toHaveLength(2));
    await act(async () =>
      requests[1].complete(200, { avatarMediaId: "new-photo" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    view.rerender(
      <ProfileSettings person={{ ...person, avatarMediaId: "new-photo" }} />,
    );
    expect(name).toHaveValue("Morgan");
    expect(screen.getByRole("button", { name: "Save profile" })).toBeEnabled();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("releases the local crop on cancel without uploading", async () => {
    const user = userEvent.setup();
    render(<ProfilePhotoEditor person={person} />, { wrapper: wrap });
    await user.upload(
      screen.getByLabelText("Choose profile photo"),
      new File(["png"], "photo.png", { type: "image/png" }),
    );
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(dispose).toHaveBeenCalledOnce();
    expect(requests).toHaveLength(0);
  });

  it("does not reopen an editor when a pending decode completes after unmount", async () => {
    const user = userEvent.setup();
    let finish!: (value: unknown) => void;
    image.prepare.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const view = render(<ProfilePhotoEditor person={person} />, {
      wrapper: wrap,
    });
    await user.upload(
      screen.getByLabelText("Choose profile photo"),
      new File(["png"], "photo.png", { type: "image/png" }),
    );
    view.unmount();
    await act(async () =>
      finish({ source: {}, width: 1600, height: 900, dispose }),
    );
    expect(dispose).toHaveBeenCalledOnce();
    expect(requests).toHaveLength(0);
  });

  it("restores the default avatar only after the server confirms removal", async () => {
    const user = userEvent.setup();
    render(
      <ProfilePhotoEditor
        person={{ ...person, avatarMediaId: "saved-photo" }}
      />,
      { wrapper: wrap },
    );
    await user.click(screen.getByRole("button", { name: "Use default" }));
    expect(requests[0].open).toHaveBeenCalledWith(
      "DELETE",
      "/api/profile/photo",
    );
    expect(
      screen.queryByText("Default avatar restored."),
    ).not.toBeInTheDocument();
    await act(async () => requests[0].complete(200, { avatarMediaId: null }));
    expect(screen.getByText("Default avatar restored.")).toBeVisible();
  });
});
