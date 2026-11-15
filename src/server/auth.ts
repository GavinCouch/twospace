import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { db, dataDirectory } from './database';

function loadSecret(): string {
  if (process.env.BETTER_AUTH_SECRET) return process.env.BETTER_AUTH_SECRET;
  const path = join(dataDirectory, '.auth-secret');
  try { return readFileSync(path, 'utf8'); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    try { writeFileSync(path, randomBytes(48).toString('base64url'), { mode: 0o600, flag: 'wx' }); }
    catch (writeError) { if ((writeError as NodeJS.ErrnoException).code !== 'EEXIST') throw writeError; }
    return readFileSync(path, 'utf8');
  }
}
const secret = loadSecret();
export const appOrigin = process.env.BETTER_AUTH_URL || 'http://127.0.0.1:3100';
export const auth = betterAuth({
  appName: 'TwoSpace', baseURL: appOrigin, secret, database: db,
  trustedOrigins: [appOrigin, 'http://localhost:3100', 'http://127.0.0.1:3100'],
  emailAndPassword: { enabled: true, minPasswordLength: 10, maxPasswordLength: 128 },
  session: { expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
  rateLimit: { enabled: true, window: 60, max: 30 },
});
const globals = globalThis as unknown as { twospaceAuthReady?: Promise<void> };
export function ready(): Promise<void> {
  return globals.twospaceAuthReady ??= getMigrations(auth.options)
    .then(({ runMigrations }) => runMigrations()).then(() => undefined)
    .catch(error => { globals.twospaceAuthReady = undefined; throw error; });
}

const encryptionKey = createHash('sha256').update(secret).digest();
export function seal(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
}
export function unseal(value: string): string {
  const data = Buffer.from(value, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey, data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
}
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
