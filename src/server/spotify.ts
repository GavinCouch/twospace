import { z } from "zod";
import { HttpError } from "./http";
import {
  spotifyTrackId,
  spotifyTrackUrl,
  type SpotifyTrack,
} from "@/shared/music";

const trackId = z.string().regex(/^[A-Za-z0-9]{22}$/);
const imageUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.hostname === "i.scdn.co" || url.hostname.endsWith(".spotifycdn.com"))
      ? url.href
      : null;
  } catch {
    return null;
  }
};
const apiTrack = z.object({
  id: trackId,
  name: z.string().min(1),
  artists: z.array(z.object({ name: z.string() })),
  album: z.object({
    name: z.string(),
    images: z.array(z.object({ url: z.string() })).default([]),
  }),
  duration_ms: z.number().nonnegative().nullable().optional(),
});
const embedData = z.object({
  provider_name: z.literal("Spotify"),
  title: z.string().min(1),
  thumbnail_url: z.string().optional(),
  iframe_url: z.string().optional(),
  html: z.string().optional(),
});
type Cached<T> = { value: T; expires: number };
const tracks = new Map<string, Cached<SpotifyTrack>>();
const searches = new Map<string, Cached<SpotifyTrack[]>>();
let token: { value: string; expires: number; credentials: string } | undefined;
let tokenRequest: Promise<string> | undefined;
let apiBlockedUntil = 0;
let embedBlockedUntil = 0;

export const spotifySearchAvailable = () =>
  Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
const market = () =>
  /^[A-Z]{2}$/.test(process.env.SPOTIFY_MARKET || "")
    ? process.env.SPOTIFY_MARKET!
    : "US";
const unavailable = () =>
  new HttpError(
    503,
    "Spotify search is unavailable right now. You can still paste a song link.",
    "SPOTIFY_UNAVAILABLE",
  );
const busy = () =>
  new HttpError(
    429,
    "Spotify is receiving too many requests. Wait a moment, or open the song on Spotify.",
    "SPOTIFY_RATE_LIMIT",
  );

function cached<T>(cache: Map<string, Cached<T>>, key: string) {
  const item = cache.get(key);
  if (item && item.expires > Date.now()) return item.value;
  cache.delete(key);
}
function remember<T>(
  cache: Map<string, Cached<T>>,
  key: string,
  value: T,
  ttl = 300_000,
) {
  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  cache.set(key, { value, expires: Date.now() + ttl });
  return value;
}
async function request(url: string, init: RequestInit = {}) {
  try {
    return await fetch(url, {
      ...init,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
  } catch {
    throw new HttpError(
      502,
      "Spotify couldn’t be reached. Please try again.",
      "SPOTIFY_UNREACHABLE",
    );
  }
}
function blocked(response: Response, kind: "api" | "embed") {
  const after = response.headers.get("retry-after") || "30";
  const seconds = Number(after);
  const until = Number.isFinite(seconds)
    ? Date.now() + Math.max(1, seconds) * 1000
    : Date.parse(after);
  const retryAt = Number.isFinite(until) ? until : Date.now() + 30_000;
  if (kind === "api") apiBlockedUntil = retryAt;
  else embedBlockedUntil = retryAt;
  throw busy();
}
async function accessToken(): Promise<string> {
  if (!spotifySearchAvailable()) throw unavailable();
  if (Date.now() < apiBlockedUntil) throw busy();
  const credentials = `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`;
  if (token?.credentials === credentials && token.expires > Date.now())
    return token.value;
  if (tokenRequest) return tokenRequest;
  tokenRequest = (async () => {
    const response = await request("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(credentials).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (response.status === 429) blocked(response, "api");
    if (!response.ok) throw unavailable();
    const data = z
      .object({
        access_token: z.string().min(1),
        expires_in: z.number().positive(),
      })
      .safeParse(await response.json().catch(() => null));
    if (!data.success) throw unavailable();
    token = {
      value: data.data.access_token,
      credentials,
      expires: Date.now() + Math.max(1, data.data.expires_in - 60) * 1000,
    };
    return token.value;
  })();
  try {
    return await tokenRequest;
  } finally {
    tokenRequest = undefined;
  }
}
async function spotifyApi(path: string, retry = true): Promise<unknown> {
  if (Date.now() < apiBlockedUntil) throw busy();
  const response = await request(`https://api.spotify.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${await accessToken()}` },
  });
  if (response.status === 401 && retry) {
    token = undefined;
    return spotifyApi(path, false);
  }
  if (response.status === 429) blocked(response, "api");
  if (response.status === 404)
    throw new HttpError(404, "That song isn’t available on Spotify.");
  if (!response.ok) throw unavailable();
  return response.json().catch(() => {
    throw unavailable();
  });
}
function normalize(value: z.infer<typeof apiTrack>): SpotifyTrack {
  return {
    id: value.id,
    title: value.name,
    artists: value.artists.map((artist) => artist.name),
    album: value.album.name,
    imageUrl: imageUrl(value.album.images[0]?.url),
    durationMs: value.duration_ms ?? null,
    url: spotifyTrackUrl(value.id),
  };
}
export async function searchSpotify(query: string): Promise<SpotifyTrack[]> {
  const q = z
    .string()
    .trim()
    .min(2, "Enter at least two characters.")
    .max(200)
    .parse(query);
  if (!spotifySearchAvailable()) throw unavailable();
  const key = `${market()}:${q}`;
  const previous = cached(searches, key);
  if (previous) return previous;
  const params = new URLSearchParams({
    q,
    type: "track",
    market: market(),
    limit: "10",
  });
  const result = z
    .object({ tracks: z.object({ items: z.array(z.unknown()) }) })
    .safeParse(await spotifyApi(`search?${params}`));
  if (!result.success) throw unavailable();
  const found = result.data.tracks.items.flatMap((item) => {
    const parsed = apiTrack.safeParse(item);
    if (!parsed.success) return [];
    const song = normalize(parsed.data);
    remember(tracks, `${market()}:${song.id}`, song);
    return [song];
  });
  return remember(searches, key, found, 60_000);
}
async function oembed(url: string) {
  if (Date.now() < embedBlockedUntil) throw busy();
  const response = await request(
    `https://open.spotify.com/oembed?${new URLSearchParams({ url })}`,
  );
  if (response.status === 429) blocked(response, "embed");
  if (response.status === 404 || response.status === 400)
    throw new HttpError(
      404,
      "That song link could not be found. Copy its song link from Spotify and try again.",
    );
  if (!response.ok)
    throw new HttpError(
      502,
      "Spotify couldn’t load that song. Please try again.",
    );
  const result = embedData.safeParse(await response.json().catch(() => null));
  if (!result.success)
    throw new HttpError(
      502,
      "Spotify returned an incomplete song preview. Please try again.",
    );
  return result.data;
}
function embedTrackId(data: z.infer<typeof embedData>) {
  const src =
    data.iframe_url || /\bsrc=["']([^"']+)["']/.exec(data.html || "")?.[1];
  if (!src) return null;
  try {
    const url = new URL(src);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "open.spotify.com" ||
      url.username ||
      url.password ||
      url.port
    )
      return null;
    return (
      /^\/embed\/track\/([A-Za-z0-9]{22})\/?$/.exec(url.pathname)?.[1] ?? null
    );
  } catch {
    return null;
  }
}
function fromEmbed(id: string, data: z.infer<typeof embedData>): SpotifyTrack {
  return {
    id,
    title: data.title,
    artists: [],
    album: "",
    imageUrl: imageUrl(data.thumbnail_url),
    durationMs: null,
    url: spotifyTrackUrl(id),
  };
}
export async function getSpotifyTrack(value: string): Promise<SpotifyTrack> {
  const id = trackId.parse(value);
  const key = `${market()}:${id}`;
  const previous = cached(tracks, key);
  if (previous) return previous;
  if (spotifySearchAvailable()) {
    try {
      const parsed = apiTrack.safeParse(
        await spotifyApi(
          `tracks/${id}?${new URLSearchParams({ market: market() })}`,
        ),
      );
      if (parsed.success) return remember(tracks, key, normalize(parsed.data));
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      // An app quota or credential issue should not prevent sharing a public song link.
    }
  }
  const data = await oembed(spotifyTrackUrl(id));
  if (embedTrackId(data) !== id)
    throw new HttpError(
      400,
      "Choose a Spotify song, rather than an album or playlist.",
    );
  return remember(tracks, key, fromEmbed(id, data));
}
export async function resolveSpotifyLink(value: string): Promise<SpotifyTrack> {
  const link = z.string().trim().min(1).max(2000).parse(value);
  const id = spotifyTrackId(link);
  if (id) return getSpotifyTrack(id);
  // Spotify resolves its own short links; never follow arbitrary redirects from user input.
  let short: URL;
  try {
    short = new URL(link);
  } catch {
    throw new HttpError(400, "Paste a Spotify song link.");
  }
  if (
    short.protocol !== "https:" ||
    short.hostname !== "spotify.link" ||
    short.port ||
    short.username ||
    short.password ||
    !/^\/[A-Za-z0-9]+\/?$/.test(short.pathname)
  )
    throw new HttpError(
      400,
      "Paste a Spotify song link, rather than an album or playlist.",
    );
  const data = await oembed(short.href);
  const resolved = embedTrackId(data);
  if (!resolved)
    throw new HttpError(
      400,
      "Choose a Spotify song, rather than an album or playlist.",
    );
  return remember(tracks, `${market()}:${resolved}`, fromEmbed(resolved, data));
}

const limits = new Map<string, { count: number; expires: number }>();
export function limitSpotifyRequests(userId: string) {
  const current = limits.get(userId);
  if (!current || current.expires <= Date.now()) {
    if (limits.size >= 1000)
      for (const [key, value] of limits)
        if (value.expires <= Date.now()) limits.delete(key);
    if (limits.size >= 1000) throw busy();
    limits.set(userId, { count: 1, expires: Date.now() + 60_000 });
  } else if (++current.count > 40) throw busy();
}
