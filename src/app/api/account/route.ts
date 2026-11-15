import { account, route } from '@/server/http';
export const GET = route(request => account(request));
