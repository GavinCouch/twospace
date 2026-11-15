import { route } from '@/server/http';
import { replyToEntry } from '@/server/entries';
export const POST = route((request, { id }) => replyToEntry(request, id));
