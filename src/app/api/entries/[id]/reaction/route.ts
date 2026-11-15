import { route } from '@/server/http';
import { reactToEntry } from '@/server/entries';
export const POST = route((request, { id }) => reactToEntry(request, id));
