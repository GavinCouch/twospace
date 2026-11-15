import type {
  Drawing,
  Entry,
  Game,
  PhotoPair,
  Plan,
  QuestionRound,
  SpaceSnapshot,
} from "@/shared/types";
import { context, type Context } from "./http";
import { resources, row } from "./database";
import { visibleEntry } from "./entries";
import { allIdeas, visibleGame, visibleQuestion } from "./activities";
import { listMusicSongs } from "./music";
export async function snapshot(ctx: Context): Promise<SpaceSnapshot> {
  const space = (await row<{
    id: string;
    name: string;
    created_at: string;
    is_demo: number;
  }>("SELECT * FROM spaces WHERE id=?", ctx.spaceId))!;
  return {
    space: {
      id: space.id,
      name: space.name,
      createdAt: space.created_at,
      isDemo: !!space.is_demo,
    },
    me: ctx.me,
    members: ctx.members,
    entries: (await resources<Entry>(ctx.spaceId, "entry")).map((entry) =>
      visibleEntry(entry, ctx.account.id),
    ),
    photoPairs: await resources<PhotoPair>(ctx.spaceId, "photoPair"),
    questions: (await resources<QuestionRound>(ctx.spaceId, "question")).map(
      (question) => visibleQuestion(question, ctx.account.id),
    ),
    games: (await resources<Game>(ctx.spaceId, "game")).map((game) =>
      visibleGame(game, ctx.account.id),
    ),
    drawings: await resources<Drawing>(ctx.spaceId, "drawing"),
    ideas: await allIdeas(ctx.spaceId),
    plans: await resources<Plan>(ctx.spaceId, "plan"),
  };
}
export async function getSnapshot(request: Request) {
  return await snapshot(await context(request));
}
export async function exportSnapshot(request: Request) {
  const data = await getSnapshot(request);
  return new Response(
    JSON.stringify(
      {
        format: "twospace-1",
        exportedAt: new Date().toISOString(),
        ...data,
        songs: await listMusicSongs(data.space.id),
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
