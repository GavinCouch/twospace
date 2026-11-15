import { route } from '@/server/http';
import { createDrawing } from '@/server/drawings';
export const POST = route(createDrawing);
