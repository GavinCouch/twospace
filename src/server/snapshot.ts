import type { Drawing, Entry, Game, PhotoPair, Plan, QuestionRound, SpaceSnapshot } from '@/shared/types';
import { context, type Context } from './http';
import { resources, row } from './database';
import { visibleEntry } from './entries';
import { allIdeas, visibleGame, visibleQuestion } from './activities';

export function snapshot(ctx: Context): SpaceSnapshot {
  const space = row<{ id: string; name: string; created_at: string; is_demo: number }>('SELECT * FROM spaces WHERE id=?', ctx.spaceId)!;
  return {
    space: { id: space.id, name: space.name, createdAt: space.created_at, isDemo: !!space.is_demo },
    me: ctx.me, members: ctx.members,
    entries: resources<Entry>(ctx.spaceId, 'entry').map(entry => visibleEntry(entry, ctx.account.id)),
    photoPairs: resources<PhotoPair>(ctx.spaceId, 'photoPair'),
    questions: resources<QuestionRound>(ctx.spaceId, 'question').map(question => visibleQuestion(question, ctx.account.id)),
    games: resources<Game>(ctx.spaceId, 'game').map(game => visibleGame(game, ctx.account.id)),
    drawings: resources<Drawing>(ctx.spaceId, 'drawing'), ideas: allIdeas(ctx.spaceId), plans: resources<Plan>(ctx.spaceId, 'plan'),
  };
}
export async function getSnapshot(request: Request) { return snapshot(await context(request)); }
export async function exportSnapshot(request: Request) {
  const data = await getSnapshot(request);
  return new Response(JSON.stringify({ format: 'twospace-1', exportedAt: new Date().toISOString(), ...data }, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="twospace.json"', 'Cache-Control': 'private, no-store' },
  });
}
