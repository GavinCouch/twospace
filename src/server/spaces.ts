import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { db, id, now, row, transaction } from './database';
import { account, context, HttpError, json, shortText } from './http';
import { hashToken } from './auth';

db.exec('CREATE TABLE IF NOT EXISTS pair_history (space_id TEXT PRIMARY KEY REFERENCES spaces(id) ON DELETE CASCADE)');
export async function createSpace(request: Request) {
  const current = await account(request);
  const { name } = await json(request, z.object({ name: shortText.min(1).default('Our space') }));
  return transaction(() => {
    if (row('SELECT 1 FROM memberships WHERE user_id=?', current.id)) throw new HttpError(409, 'You already belong to a space.');
    const spaceId = id();
    db.prepare('INSERT INTO spaces(id,name,created_at) VALUES(?,?,?)').run(spaceId, name, now());
    db.prepare('INSERT INTO memberships(user_id,space_id,slot) VALUES(?,?,1)').run(current.id, spaceId);
    return { id: spaceId, name };
  });
}
export async function renameSpace(request: Request) {
  const ctx = await context(request);
  const { name } = await json(request, z.object({ name: shortText.min(1) }));
  db.prepare('UPDATE spaces SET name=? WHERE id=?').run(name, ctx.spaceId);
  return { ok: true };
}
export async function invite(request: Request) {
  const ctx = await context(request);
  if (ctx.account.isDemo) throw new HttpError(400, 'Create your own account to invite a partner.');
  return transaction(() => {
    if (ctx.members.length > 1) throw new HttpError(409, 'Both places in this space are already taken.');
    if (row('SELECT 1 FROM pair_history WHERE space_id=?', ctx.spaceId)) throw new HttpError(409, 'Create a new space before inviting someone new. Your existing memories stay here.');
    db.prepare('DELETE FROM invitations WHERE space_id=?').run(ctx.spaceId);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO invitations(token_hash,space_id,expires_at) VALUES(?,?,?)').run(hashToken(token), ctx.spaceId, expiresAt);
    return { token, expiresAt };
  });
}
export async function acceptInvite(request: Request) {
  const current = await account(request);
  if (current.isDemo) throw new HttpError(400, 'Use your own account to accept an invitation.');
  const { token } = await json(request, z.object({ token: z.string().min(20).max(128) }));
  return transaction(() => {
    if (row('SELECT 1 FROM memberships WHERE user_id=?', current.id)) throw new HttpError(409, 'You already belong to a space.');
    const invitation = row<{ space_id: string; expires_at: string; used: number }>('SELECT * FROM invitations WHERE token_hash=?', hashToken(token));
    if (!invitation || invitation.used || invitation.expires_at <= now()) throw new HttpError(410, 'This invitation has expired or has already been used. Ask for a new one.');
    const count = row<{ count: number }>('SELECT COUNT(*) count FROM memberships WHERE space_id=?', invitation.space_id)!.count;
    if (count !== 1) throw new HttpError(409, 'This space is no longer available.');
    db.prepare('INSERT INTO memberships(user_id,space_id,slot) VALUES(?,?,2)').run(current.id, invitation.space_id);
    db.prepare('UPDATE invitations SET used=1 WHERE space_id=?').run(invitation.space_id);
    db.prepare('INSERT OR IGNORE INTO pair_history(space_id) VALUES(?)').run(invitation.space_id);
    return { spaceId: invitation.space_id };
  });
}
export async function leaveSpace(request: Request) {
  const ctx = await context(request);
  if (ctx.account.isDemo) throw new HttpError(400, 'Start a new demo to reset this sample space.');
  transaction(() => {
    db.prepare('DELETE FROM invitations WHERE space_id=?').run(ctx.spaceId);
    db.prepare('INSERT OR IGNORE INTO pair_history(space_id) VALUES(?)').run(ctx.spaceId);
    db.prepare('DELETE FROM memberships WHERE user_id=?').run(ctx.account.id);
  });
  return { ok: true };
}
export async function updateProfile(request: Request) {
  const current = await account(request);
  const update = await json(request, z.object({
    name: shortText.min(1).optional(),
    timeZone: z.string().max(100).refine(zone => { try { new Intl.DateTimeFormat('en', { timeZone: zone }); return true; } catch { return false; } }, 'Choose a valid time zone.').optional(),
    color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    availableFrom: z.number().int().min(0).max(23).optional(), availableTo: z.number().int().min(0).max(23).optional(),
  }));
  const columns = { name: 'name', timeZone: 'time_zone', color: 'color', availableFrom: 'available_from', availableTo: 'available_to' } as const;
  for (const [key, value] of Object.entries(update)) if (value !== undefined) db.prepare(`UPDATE profiles SET ${columns[key as keyof typeof columns]}=? WHERE user_id=?`).run(value, current.id);
  return { ok: true };
}
