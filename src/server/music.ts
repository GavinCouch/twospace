import { z } from "zod";
import type { DailySong, MusicSnapshot } from "@/shared/music";
import { localDateInZone } from "@/shared/time";
import {
  insertResource,
  now,
  resource,
  resources,
  row,
  updateResource,
} from "./database";
import {
  pairedContext,
  found,
  HttpError,
  json,
  spaceTransaction,
} from "./http";
import {
  getSpotifyTrack,
  limitSpotifyRequests,
  spotifySearchAvailable,
} from "./spotify";

type RemovedSong = {
  id: string;
  authorId: string;
  day: string;
  revision: number;
  deleted: true;
};
type StoredSong = DailySong | RemovedSong;

const pickFields = z.object({
  trackId: z.string().regex(/^[A-Za-z0-9]{22}$/, "Choose a Spotify song."),
  note: z.string().trim().max(2000).default(""),
  day: z.iso.date(),
  revision: z.number().int().nonnegative().default(0),
});

function isSong(value: StoredSong): value is DailySong {
  return !("deleted" in value && value.deleted);
}

export async function listMusicSongs(spaceId: string): Promise<DailySong[]> {
  return (await resources<StoredSong>(spaceId, "song")).filter(isSong);
}

export async function getMusic(request: Request): Promise<MusicSnapshot> {
  const ctx = await pairedContext(request);
  return spaceTransaction(ctx, async () => ({
    songs: await listMusicSongs(ctx.spaceId),
    today: localDateInZone(now(), ctx.me.timeZone),
    searchAvailable: spotifySearchAvailable(),
  }));
}

export async function saveTodaySong(request: Request): Promise<DailySong> {
  const ctx = await pairedContext(request);
  const input = await json(request, pickFields);
  function checkDay(timeZone = ctx.me.timeZone) {
    if (input.day !== localDateInZone(now(), timeZone))
      throw new HttpError(
        409,
        "A new day has started. Refresh before choosing today’s song.",
        "MUSIC_DAY_CHANGED",
      );
  }
  checkDay();
  const songId = `song:${ctx.account.id}:${input.day}`;
  const before = await resource<StoredSong>(ctx.spaceId, "song", songId);
  const current = before && isSong(before) ? before : undefined;
  if (input.revision !== (current?.revision ?? 0))
    throw new HttpError(
      409,
      "Your song changed. Refresh before saving again.",
      "MUSIC_CONFLICT",
    );

  // Verify song metadata on the server; editing just the note works during an outage.
  if (current?.track.id !== input.trackId) limitSpotifyRequests(ctx.account.id);
  const track =
    current?.track.id === input.trackId
      ? current.track
      : await getSpotifyTrack(input.trackId);

  return spaceTransaction(ctx, async () => {
    const profile = found(
      await row<{ time_zone: string }>(
        "SELECT time_zone FROM profiles WHERE user_id=?",
        ctx.account.id,
      ),
    );
    checkDay(profile.time_zone);
    const stored = await resource<StoredSong>(ctx.spaceId, "song", songId);
    const existing = stored && isSong(stored) ? stored : undefined;
    if (
      input.revision !== (existing?.revision ?? 0) ||
      (stored?.revision ?? 0) !== (before?.revision ?? 0)
    )
      throw new HttpError(
        409,
        "Your song changed. Refresh before saving again.",
        "MUSIC_CONFLICT",
      );
    const savedAt = now();
    const song: DailySong = {
      id: songId,
      authorId: ctx.account.id,
      day: input.day,
      timeZone: profile.time_zone,
      track,
      note: input.note,
      createdAt: existing?.createdAt ?? savedAt,
      updatedAt: savedAt,
      revision: (stored?.revision ?? 0) + 1,
    };
    return stored
      ? updateResource(ctx.spaceId, "song", song)
      : insertResource(ctx.spaceId, "song", ctx.account.id, song);
  });
}

export async function deleteSong(request: Request, songId: string) {
  const ctx = await pairedContext(request);
  const input = await json(
    request,
    z.object({ revision: z.number().int().positive() }),
  );
  return spaceTransaction(ctx, async () => {
    const stored = found(
      await resource<StoredSong>(ctx.spaceId, "song", songId),
    );
    if (stored.authorId !== ctx.account.id)
      throw new HttpError(
        403,
        "Only the person who chose this song can remove it.",
      );
    if (!isSong(stored))
      throw new HttpError(404, "That song has already been removed.");
    if (stored.revision !== input.revision)
      throw new HttpError(
        409,
        "Your song changed. Refresh before removing it.",
        "MUSIC_CONFLICT",
      );
    // Keep only a revision marker so an old request cannot remove a replacement pick.
    await updateResource<RemovedSong>(ctx.spaceId, "song", {
      id: stored.id,
      authorId: stored.authorId,
      day: stored.day,
      revision: stored.revision + 1,
      deleted: true,
    });
    return { ok: true };
  });
}
