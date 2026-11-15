import { route } from '@/server/http';
import { createQuestion } from '@/server/activities';
export const POST = route(createQuestion);
