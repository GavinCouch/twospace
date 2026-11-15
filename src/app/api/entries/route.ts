import { route } from '@/server/http';
import { createEntry } from '@/server/entries';
export const POST = route(createEntry);
