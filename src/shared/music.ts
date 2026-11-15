export type SpotifyTrack = {
  id: string;
  title: string;
  artists: string[];
  album: string;
  imageUrl: string | null;
  durationMs: number | null;
  url: string;
};

export type DailySong = {
  id: string;
  authorId: string;
  day: string;
  timeZone: string;
  track: SpotifyTrack;
  note: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
};

export type MusicSnapshot = {
  songs: DailySong[];
  today: string;
  searchAvailable: boolean;
};

export type MusicSearch = { tracks: SpotifyTrack[] };

export function spotifyTrackId(value: string): string | null {
  const text = value.trim();
  const uri = /^spotify:track:([A-Za-z0-9]{22})$/.exec(text);
  if (uri) return uri[1];
  try {
    const url = new URL(text);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "open.spotify.com" ||
      url.port ||
      url.username ||
      url.password
    )
      return null;
    return (
      /^\/(?:intl-[a-z]{2}\/)?track\/([A-Za-z0-9]{22})\/?$/.exec(
        url.pathname,
      )?.[1] ?? null
    );
  } catch {
    return null;
  }
}

export const spotifyTrackUrl = (id: string) =>
  `https://open.spotify.com/track/${id}`;
export const spotifyEmbedUrl = (id: string) =>
  `https://open.spotify.com/embed/track/${id}?utm_source=generator&theme=0`;
