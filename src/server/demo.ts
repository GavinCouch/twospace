import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { auth, ready, seal, unseal, hashToken, appOrigin } from './auth';
import { db, id, now, row, transaction } from './database';
import { account, HttpError, json, response, ensureProfile } from './http';
import { seedDemo } from './seed';
import type { Account } from '@/shared/types';

const COOKIE = 'twospace.demo';
const globals = globalThis as unknown as { twospaceDemoLimits?: Map<string, { count: number; expires: number }> };
const limits = globals.twospaceDemoLimits ??= new Map();
function limitStarts(request: Request) {
  const key = hashToken(request.headers.get('x-forwarded-for')?.split(',')[0] || 'local');
  const current = limits.get(key);
  if (current && current.expires > Date.now() && current.count >= 20) throw new HttpError(429, 'You have started several demos. Try again in an hour.');
  limits.set(key, current && current.expires > Date.now() ? { ...current, count: current.count + 1 } : { count: 1, expires: Date.now() + 3_600_000 });
  for (const [entry, value] of limits) if (value.expires < Date.now()) limits.delete(entry);
}
async function demoResponse(userId: string, token?: string) {
  const credentials = row<{ email: string; credential: string; space_id: string }>('SELECT * FROM demo_credentials WHERE user_id=?', userId);
  if (!credentials) throw new HttpError(404, 'This demo has expired. Start another.');
  const signedIn = await auth.api.signInEmail({ body: { email: credentials.email, password: unseal(credentials.credential) }, asResponse: true });
  if (!signedIn.ok) throw new HttpError(500, 'The demo could not be opened. Please try again.');
  const profile = row<{ name: string }>('SELECT name FROM profiles WHERE user_id=?', userId)!;
  const result = response({ id: userId, name: profile.name, email: credentials.email, spaceId: credentials.space_id, isDemo: true } satisfies Account);
  for (const cookie of signedIn.headers.getSetCookie()) result.headers.append('Set-Cookie', cookie);
  if (token) result.headers.append('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${appOrigin.startsWith('https:') ? '; Secure' : ''}`);
  return result;
}
export async function createDemo(request: Request) {
  await ready();
  try { const current = await account(request); if (!current.isDemo) throw new HttpError(409, 'Sign out before opening the sample space.'); }
  catch (error) { if (!(error instanceof HttpError && error.status === 401)) throw error; }
  limitStarts(request);
  const spaceId = id(), token = randomBytes(32).toString('base64url');
  const makeUser = async (name: string) => {
    const email = `${name.toLowerCase()}.${id()}@demo.twospace.invalid`, password = randomBytes(40).toString('base64url');
    const created = await auth.api.signUpEmail({ body: { email, password, name } });
    ensureProfile(created.user.id, name);
    return { id: created.user.id, email, credential: seal(password) };
  };
  const alex = await makeUser('Alex'), jamie = await makeUser('Jamie');
  transaction(() => {
    db.prepare('INSERT INTO spaces(id,name,created_at,is_demo) VALUES(?,?,?,1)').run(spaceId, 'Alex & Jamie', now());
    for (const [index, user] of [alex, jamie].entries()) {
      db.prepare('INSERT INTO memberships(user_id,space_id,slot) VALUES(?,?,?)').run(user.id, spaceId, index + 1);
      db.prepare('UPDATE profiles SET is_demo=1,time_zone=?,color=? WHERE user_id=?').run(index ? 'Europe/London' : 'America/Chicago', index ? '#CB785F' : '#416B67', user.id);
      db.prepare('INSERT INTO demo_credentials(user_id,email,credential,space_id) VALUES(?,?,?,?)').run(user.id, user.email, user.credential, spaceId);
    }
    db.prepare('INSERT INTO demo_rooms(token_hash,space_id,expires_at) VALUES(?,?,?)').run(hashToken(token), spaceId, new Date(Date.now() + 86_400_000).toISOString());
  });
  await seedDemo(spaceId, alex.id, jamie.id);
  return demoResponse(alex.id, token);
}
export async function switchDemo(request: Request) {
  const current = await account(request);
  if (!current.isDemo || !current.spaceId) throw new HttpError(403, 'Profile switching is available only in the sample space.');
  const { userId } = await json(request, z.object({ userId: z.string().min(1).max(128) }));
  const token = request.headers.get('cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  const room = token ? row<{ space_id: string; expires_at: string }>('SELECT * FROM demo_rooms WHERE token_hash=?', hashToken(token)) : undefined;
  if (!room || room.expires_at <= now() || room.space_id !== current.spaceId) throw new HttpError(403, 'Start a new demo to switch profiles.');
  if (!row('SELECT 1 FROM demo_credentials WHERE user_id=? AND space_id=?', userId, room.space_id)) throw new HttpError(403, 'That profile belongs to another space.');
  return demoResponse(userId);
}
