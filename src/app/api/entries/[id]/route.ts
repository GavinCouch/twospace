import { route } from '@/server/http';
import { editEntry, deleteEntry } from '@/server/entries';
export const PATCH = route((request, { id }) => editEntry(request, id));
export const DELETE = route((request, { id }) => deleteEntry(request, id));
