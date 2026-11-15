import { auth, ready } from '@/server/auth';
export const runtime = 'nodejs';
async function handler(request: Request) { await ready(); return auth.handler(request); }
export { handler as GET, handler as POST };
