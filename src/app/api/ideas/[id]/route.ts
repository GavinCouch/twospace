import { route } from '@/server/http';
import { editIdea } from '@/server/activities';
export const PATCH = route((request, { id }) => editIdea(request, id));
