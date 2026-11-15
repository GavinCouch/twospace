import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { spotifyTrackId } from "@/shared/music";

vi.mock("@/server/http", () => ({
  HttpError: class extends Error {
    constructor(
      public status: number,
      message: string,
      public code?: string,
    ) {
      super(message);
    }
  },
}));

const id = "0Lr4kGOYn9l83EjuK6cZFQ";
const otherId = "11dFghVXANMlKmJXsNCbNl";
const song = {
  id,
  name: "Song title",
  artists: [{ name: "Artist" }],
  album: { name: "Album", images: [{ url: "https://i.scdn.co/image/cover" }] },
  duration_ms: 220000,
};
const embed = {
  provider_name: "Spotify",
  title: "Song title",
  type: "video",
  thumbnail_url: "https://image-cdn-ak.spotifycdn.com/image/cover",
  iframe_url: `https://open.spotify.com/embed/track/${id}`,
};
const json = (body: unknown, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers });
let spotify: typeof import("@/server/spotify");
const fetchMock = vi.fn<typeof fetch>();

beforeEach(async () => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("SPOTIFY_CLIENT_ID", "");
  vi.stubEnv("SPOTIFY_CLIENT_SECRET", "");
  vi.stubEnv("SPOTIFY_MARKET", "US");
  spotify = await import("@/server/spotify");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
function credentials() {
  vi.stubEnv("SPOTIFY_CLIENT_ID", "test-client");
  vi.stubEnv("SPOTIFY_CLIENT_SECRET", "test-secret");
}

describe("Spotify integration", () => {
  it("normalizes track links and URIs without accepting other hosts or entities", () => {
    expect(
      spotifyTrackId(`https://open.spotify.com/intl-de/track/${id}?si=ignored`),
    ).toBe(id);
    expect(spotifyTrackId(`spotify:track:${id}`)).toBe(id);
    for (const url of [
      `http://open.spotify.com/track/${id}`,
      `https://open.spotify.com.evil.test/track/${id}`,
      `https://user@open.spotify.com/track/${id}`,
      `https://open.spotify.com/playlist/${id}`,
      `javascript:alert(1)`,
    ])
      expect(spotifyTrackId(url)).toBeNull();
  });

  it("uses one server token, a market, ten results and caches repeated searches", async () => {
    credentials();
    fetchMock
      .mockResolvedValueOnce(
        json({ access_token: "server-token", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(json({ tracks: { items: [song, null] } }))
      .mockResolvedValueOnce(json({ tracks: { items: [song] } }));
    const result = await spotify.searchSpotify("a song & artist");
    expect(result[0]).toMatchObject({
      id,
      title: "Song title",
      artists: ["Artist"],
      url: `https://open.spotify.com/track/${id}`,
    });
    expect(result).toHaveLength(1);
    expect(await spotify.searchSpotify("a song & artist")).toEqual(result);
    await spotify.searchSpotify("another song");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const search = new URL(String(fetchMock.mock.calls[1][0]));
    expect(search.searchParams.get("q")).toBe("a song & artist");
    expect(search.searchParams.get("market")).toBe("US");
    expect(search.searchParams.get("limit")).toBe("10");
    expect(fetchMock.mock.calls[1][1]?.headers).toEqual({
      Authorization: "Bearer server-token",
    });
    expect(JSON.stringify(result)).not.toContain("server-token");
  });

  it("resolves an official public embed without credentials or HTML insertion", async () => {
    fetchMock.mockResolvedValueOnce(json(embed));
    const result = await spotify.resolveSpotifyLink(
      `https://open.spotify.com/track/${id}?si=abc`,
    );
    expect(result).toMatchObject({
      id,
      title: "Song title",
      artists: [],
      imageUrl: embed.thumbnail_url,
    });
    expect(result).not.toHaveProperty("html");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "https://open.spotify.com/oembed?",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      redirect: "error",
      cache: "no-store",
    });
  });

  it("rejects arbitrary URLs before making a request and validates short-link results", async () => {
    await expect(
      spotify.resolveSpotifyLink("https://localhost/private"),
    ).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(json(embed));
    expect(
      (await spotify.resolveSpotifyLink("https://spotify.link/validShortLink"))
        .id,
    ).toBe(id);
    expect(new URL(String(fetchMock.mock.calls[0][0])).hostname).toBe(
      "open.spotify.com",
    );
    fetchMock.mockResolvedValueOnce(
      json({
        ...embed,
        iframe_url: `https://open.spotify.com/embed/playlist/${id}`,
      }),
    );
    await expect(
      spotify.resolveSpotifyLink("https://spotify.link/playlistLink"),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("does not accept a mismatched embed or an untrusted image host", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        ...embed,
        iframe_url: `https://open.spotify.com/embed/track/${otherId}`,
      }),
    );
    await expect(spotify.getSpotifyTrack(id)).rejects.toMatchObject({
      status: 400,
    });
    fetchMock.mockResolvedValueOnce(
      json({ ...embed, thumbnail_url: "https://untrusted.test/pixel" }),
    );
    expect((await spotify.getSpotifyTrack(id)).imageUrl).toBeNull();
  });

  it("respects Spotify Retry-After without repeatedly contacting the API", async () => {
    credentials();
    vi.useFakeTimers({ toFake: ["Date"] });
    fetchMock
      .mockResolvedValueOnce(
        json({ access_token: "server-token", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(json({}, 429, { "Retry-After": "120" }));
    await expect(spotify.searchSpotify("first query")).rejects.toMatchObject({
      status: 429,
    });
    await expect(spotify.searchSpotify("second query")).rejects.toMatchObject({
      status: 429,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.setSystemTime(Date.now() + 120001);
    fetchMock.mockResolvedValueOnce(json({ tracks: { items: [] } }));
    expect(await spotify.searchSpotify("second query")).toEqual([]);
  });

  it("refreshes an expired token only once and keeps failed search compatible with links", async () => {
    credentials();
    fetchMock
      .mockResolvedValueOnce(
        json({ access_token: "first-token", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(
        json({ access_token: "second-token", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(json({}, 401));
    await expect(spotify.searchSpotify("a song")).rejects.toMatchObject({
      status: 503,
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    fetchMock
      .mockResolvedValueOnce(json({}, 403))
      .mockResolvedValueOnce(json(embed));
    expect((await spotify.getSpotifyTrack(id)).id).toBe(id);
  });

  it("rejects unconfigured search and incomplete upstream data without inventing results", async () => {
    await expect(spotify.searchSpotify("song")).rejects.toMatchObject({
      status: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(
      json({ provider_name: "Spotify", title: "" }),
    );
    await expect(spotify.getSpotifyTrack(id)).rejects.toMatchObject({
      status: 502,
    });
  });

  it("bounds catalog requests by user and resets after a minute", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    for (let count = 0; count < 40; count++)
      spotify.limitSpotifyRequests("alex");
    expect(() => spotify.limitSpotifyRequests("alex")).toThrow();
    expect(() => spotify.limitSpotifyRequests("jamie")).not.toThrow();
    vi.setSystemTime(Date.now() + 60001);
    expect(() => spotify.limitSpotifyRequests("alex")).not.toThrow();
  });
});
