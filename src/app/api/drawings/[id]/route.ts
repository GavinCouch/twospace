import { route } from '@/server/http';
import { editDrawing } from '@/server/drawings';
export const PATCH = route((request, { id }) => editDrawing(request, id));
