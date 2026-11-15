import { route } from '@/server/http';
import { moveGame } from '@/server/activities';
export const POST = route((request, { id }) => moveGame(request, id));
