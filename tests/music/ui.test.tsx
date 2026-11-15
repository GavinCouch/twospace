// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import { MusicPicker } from "@/features/music/music-picker";
import { MusicContent } from "@/features/music/music-page";
import { SongCard } from "@/features/music/music-card";
import type { DailySong, SpotifyTrack } from "@/shared/music";
import type { SpaceSnapshot } from "@/shared/types";

const requests = vi.hoisted(() => ({ api: vi.fn(), save: vi.fn() }));
const action = vi.hoisted(() => ({
  pending: false,
  error: null as string | null,
}));
vi.mock("@/components/space-provider", () => ({
  api: requests.api,
  useAction: () => ({ ...action, run: requests.save, clearError: vi.fn() }),
  useSpace: () => ({ data: undefined }),
}));

const track: SpotifyTrack = {
  id: "0Lr4kGOYn9l83EjuK6cZFQ",
  title: "The song",
  artists: ["The artist"],
  album: "The album",
  imageUrl: null,
  durationMs: 180000,
  url: "https://open.spotify.com/track/0Lr4kGOYn9l83EjuK6cZFQ",
};
const song: DailySong = {
  id: "song-a",
  authorId: "a",
  day: "2026-11-15",
  timeZone: "America/Chicago",
  track,
  note: "For the walk home",
  createdAt: "2026-11-15T18:00:00Z",
  updatedAt: "2026-11-15T18:00:00Z",
  revision: 1,
};
const people = [
  {
    id: "a",
    name: "Alex",
    timeZone: "America/Chicago",
    color: "#edb7c7",
    availableFrom: 18,
    availableTo: 22,
  },
  {
    id: "b",
    name: "Jamie",
    timeZone: "Europe/London",
    color: "#9dbce5",
    availableFrom: 18,
    availableTo: 22,
  },
];
const space: SpaceSnapshot = {
  space: {
    id: "space",
    name: "Our space",
    createdAt: "2026-11-15T00:00:00Z",
    isDemo: false,
  },
  me: people[0],
  members: people,
  entries: [],
  photoPairs: [],
  questions: [],
  games: [],
  drawings: [],
  ideas: [],
  plans: [],
};
let clients: QueryClient[] = [];
function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  requests.api.mockReset();
  requests.save.mockReset();
  requests.save.mockResolvedValue(song);
  action.pending = false;
  action.error = null;
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients = [];
  vi.useRealTimers();
});

describe("daily music", () => {
  it("opens the song-link tab by keyboard and resolves Spotify short links", async () => {
    const user = userEvent.setup();
    requests.api.mockResolvedValue(track);
    render(<MusicPicker day={song.day} searchAvailable onClose={vi.fn()} />, {
      wrapper,
    });
    const searchTab = screen.getByRole("tab", { name: "Search" });
    searchTab.focus();
    await user.keyboard("{ArrowRight}");
    const linkTab = screen.getByRole("tab", { name: "Song link" });
    expect(linkTab).toHaveFocus();
    expect(linkTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Song link" })).toHaveAttribute(
      "id",
      linkTab.getAttribute("aria-controls"),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Spotify song link" }),
      "https://spotify.link/SharedSong123",
    );
    await user.click(screen.getByRole("button", { name: "Find song" }));
    expect(
      await screen.findByRole("textbox", { name: "Your note" }),
    ).toBeVisible();
    expect(requests.api).toHaveBeenCalledWith(
      "/api/music/resolve?url=https%3A%2F%2Fspotify.link%2FSharedSong123",
      expect.anything(),
    );
  });

  it("resolves a pasted Spotify song and saves the verified ID with its note", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    requests.api.mockResolvedValue(track);
    render(
      <MusicPicker day="2026-11-15" searchAvailable={false} onClose={close} />,
      { wrapper },
    );
    expect(
      screen.getByRole("link", { name: /Search on Spotify/ }),
    ).toHaveAttribute("href", "https://open.spotify.com/search/");
    await user.click(screen.getByRole("tab", { name: "Song link" }));
    await user.type(
      screen.getByRole("textbox", { name: "Spotify song link" }),
      track.url + "?si=shared",
    );
    await user.click(screen.getByRole("button", { name: "Find song" }));
    await user.type(
      await screen.findByRole("textbox", { name: "Your note" }),
      "This made me think of you.",
    );
    await user.click(screen.getByRole("button", { name: "Save today’s song" }));
    expect(requests.save).toHaveBeenCalledWith(
      "/api/music/today",
      {
        trackId: track.id,
        note: "This made me think of you.",
        day: "2026-11-15",
        revision: 0,
      },
      "PUT",
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it("keeps the selected track and draft after a failed save and locks edits while saving", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    let fail!: (error: Error) => void;
    requests.save.mockReturnValueOnce(
      new Promise((_, reject) => {
        fail = reject;
      }),
    );
    const view = render(
      <MusicPicker
        initial={song}
        day={song.day}
        searchAvailable
        onClose={close}
      />,
      { wrapper },
    );
    const note = screen.getByRole("textbox", { name: "Your note" });
    await user.clear(note);
    await user.type(note, "Keep this draft");
    await user.click(screen.getByRole("button", { name: "Save today’s song" }));
    action.pending = true;
    view.rerender(
      <MusicPicker
        initial={song}
        day={song.day}
        searchAvailable
        onClose={close}
      />,
    );
    await user.type(note, " accidental edit");
    expect(note).toHaveValue("Keep this draft");
    expect(
      screen.getByRole("button", { name: "Choose a different song" }),
    ).toBeDisabled();
    fireEvent.submit(note.closest("form")!);
    expect(requests.save).toHaveBeenCalledOnce();
    await act(async () => fail(new Error("Offline")));
    action.pending = false;
    action.error = "Offline";
    view.rerender(
      <MusicPicker
        initial={song}
        day={song.day}
        searchAvailable
        onClose={close}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Offline");
    expect(note).toHaveValue("Keep this draft");
    expect(screen.getByText(track.title)).toBeVisible();
    expect(close).not.toHaveBeenCalled();
  });

  it("does not show an old search response after the query changes", async () => {
    const user = userEvent.setup();
    let finishOld!: (value: { tracks: SpotifyTrack[] }) => void;
    requests.api.mockImplementation((url: string) =>
      url.includes("q=old")
        ? new Promise((resolve) => {
            finishOld = resolve;
          })
        : Promise.resolve({ tracks: [{ ...track, title: "New result" }] }),
    );
    render(<MusicPicker day={song.day} searchAvailable onClose={vi.fn()} />, {
      wrapper,
    });
    const input = screen.getByRole("searchbox", { name: "Song or artist" });
    await user.type(input, "old");
    await waitFor(() =>
      expect(requests.api).toHaveBeenCalledWith(
        "/api/music/search?q=old",
        expect.anything(),
      ),
    );
    await user.clear(input);
    await user.type(input, "new");
    await screen.findByRole("button", {
      name: "Choose New result by The artist",
    });
    await act(async () => finishOld({ tracks: [track] }));
    expect(
      screen.queryByRole("button", { name: "Choose The song by The artist" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Choose New result by The artist" }),
    ).toBeVisible();
  });

  it("uses each person's local day and moves yesterday’s pick into history after midnight", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T23:59:55Z"));
    const jamie = {
      ...song,
      id: "song-b",
      authorId: "b",
      timeZone: "Europe/London",
      note: "Jamie’s note",
    };
    render(
      <MusicContent
        space={space}
        data={{ songs: [song, jamie], today: song.day, searchAvailable: false }}
      />,
    );
    expect(
      within(screen.getByRole("region", { name: "Today’s songs" })).getByText(
        "Jamie’s note",
      ),
    ).toBeVisible();
    await act(async () => vi.advanceTimersByTime(15_000));
    expect(
      within(screen.getByRole("region", { name: "Today’s songs" })).queryByText(
        "Jamie’s note",
      ),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Today’s songs" })).getByText(
        "For the walk home",
      ),
    ).toBeVisible();
    expect(
      within(screen.getByRole("region", { name: "Past picks" })).getByText(
        "Jamie’s note",
      ),
    ).toBeVisible();
  });

  it.each([
    {
      openedAt: "2026-11-16T06:00:10Z",
      clickedAt: "2026-11-16T06:00:10Z",
      button: "Pick today’s song",
    },
    {
      openedAt: "2026-11-16T05:59:55Z",
      clickedAt: "2026-11-16T06:00:01Z",
      button: "Change your pick",
    },
  ])(
    "opens today’s picker with the current local date at $clickedAt",
    async ({ openedAt, clickedAt, button }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(openedAt));
      render(
        <MusicContent
          space={space}
          data={{ songs: [song], today: song.day, searchAvailable: false }}
        />,
        { wrapper },
      );
      vi.setSystemTime(new Date(clickedAt));
      fireEvent.click(screen.getByRole("button", { name: button }));
      fireEvent.click(screen.getByRole("tab", { name: "Song link" }));
      requests.api.mockResolvedValue(track);
      fireEvent.change(
        screen.getByRole("textbox", { name: "Spotify song link" }),
        { target: { value: track.url } },
      );
      await act(async () =>
        fireEvent.submit(
          screen.getByRole("button", { name: "Find song" }).closest("form")!,
        ),
      );
      await act(async () =>
        fireEvent.submit(
          screen.getByRole("textbox", { name: "Your note" }).closest("form")!,
        ),
      );
      expect(requests.save).toHaveBeenCalledWith(
        "/api/music/today",
        expect.objectContaining({ day: "2026-11-16", revision: 0 }),
        "PUT",
      );
    },
  );

  it("keeps the Spotify destination available if an embedded player fails", () => {
    render(<SongCard song={song} person={people[0]} mine={false} />);
    const player = screen.getByTitle("Spotify player: The song");
    expect(player).toHaveAttribute("height", "152");
    expect(player).toHaveAttribute(
      "allow",
      expect.stringContaining("encrypted-media"),
    );
    expect(player).toHaveAttribute(
      "src",
      expect.stringContaining(`/embed/track/${track.id}`),
    );
    fireEvent.error(player);
    expect(
      screen
        .getAllByRole("link", { name: /Open in Spotify/ })
        .every((link) => link.getAttribute("href") === track.url),
    ).toBe(true);
    expect(
      screen.queryByRole("button", { name: /Remove/ }),
    ).not.toBeInTheDocument();
  });

  it("does not mount old players until their track is opened", async () => {
    const user = userEvent.setup();
    render(<SongCard song={song} person={people[0]} mine={false} history />);
    expect(
      screen.queryByTitle("Spotify player: The song"),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Show player for The song" }),
    );
    expect(screen.getByTitle("Spotify player: The song")).toBeVisible();
  });

  it("keeps the confirmed revision when another device changes a song before removal", async () => {
    const user = userEvent.setup();
    const view = render(<SongCard song={song} person={people[0]} mine />);
    await user.click(screen.getByRole("button", { name: "Remove The song" }));
    view.rerender(
      <SongCard
        song={{ ...song, revision: 2, note: "Changed elsewhere" }}
        person={people[0]}
        mine
      />,
    );
    await user.click(screen.getByRole("button", { name: "Remove song" }));
    expect(requests.save).toHaveBeenCalledWith(
      "/api/music/song-a",
      { revision: 1 },
      "DELETE",
    );
  });
});
