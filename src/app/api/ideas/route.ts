import { route } from '@/server/http';
import { createIdea } from '@/server/activities';
export const POST = route(createIdea);
