import type {
  Drawing,
  Entry,
  Game,
  PhotoPair,
  Plan,
  QuestionRound,
  SpaceSnapshot,
} from "@/shared/types";
import { context, spaceTransaction, type Context } from "./http";
import { resources, row } from "./database";
import { visibleEntry } from "./entries";
import { allIdeas, visibleGame, visibleQuestion } from "./activities";
import { listMusicSongs } from "./music";
import { spaceSwitchStatus } from "./spaces";
import { exportFiles } from "./media";
export async function snapshot(
  ctx: Context,
  includeUnpairedContent = false,
): Promise<SpaceSnapshot> {
  const space = (await row<{
    id: string;
    name: string;
    created_at: string;
    is_demo: number;
  }>("SELECT * FROM spaces WHERE id=?", ctx.spaceId))!;
  const available = ctx.members.length === 2 || includeUnpairedContent;
  return {
    space: {
      id: space.id,
      name: space.name,
      createdAt: space.created_at,
      isDemo: !!space.is_demo,
      ...(await spaceSwitchStatus(
        ctx.spaceId,
        ctx.members.length,
        ctx.account.id,
      )),
    },
    me: ctx.me,
    members: ctx.members,
    entries: (available
      ? await resources<Entry>(ctx.spaceId, "entry")
      : []
    ).map((entry) => visibleEntry(entry, ctx.account.id)),
    photoPairs: available
      ? await resources<PhotoPair>(ctx.spaceId, "photoPair")
      : [],
    questions: (available
      ? await resources<QuestionRound>(ctx.spaceId, "question")
      : []
    ).map((question) => visibleQuestion(question, ctx.account.id)),
    games: (available ? await resources<Game>(ctx.spaceId, "game") : []).map(
      (game) => visibleGame(game, ctx.account.id),
    ),
    drawings: available ? await resources<Drawing>(ctx.spaceId, "drawing") : [],
    ideas: available ? await allIdeas(ctx.spaceId) : [],
    plans: available ? await resources<Plan>(ctx.spaceId, "plan") : [],
  };
}
export async function getSnapshot(request: Request) {
  const ctx = await context(request);
  return spaceTransaction(ctx, () => snapshot(ctx));
}
export async function exportSnapshot(request: Request) {
  const ctx = await context(request);
  const { data, songs, files } = await spaceTransaction(ctx, async () => ({
    data: await snapshot(ctx, true),
    songs: await listMusicSongs(ctx.spaceId),
    files: await exportFiles(ctx),
  }));
  return new Response(
    JSON.stringify(
      {
        format: "twospace-1",
        exportedAt: new Date().toISOString(),
        ...data,
        songs,
        files,
      },
      null,
      2,
    ),
    {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="twospace.json"',
        "Cache-Control": "private, no-store",
      },
    },
  );
}
