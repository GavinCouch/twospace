import { route } from '@/server/http';
import { createGame } from '@/server/activities';
export const POST = route(createGame);
