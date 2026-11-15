import { route } from '@/server/http';
import { createPhotoPair } from '@/server/entries';
export const POST = route(createPhotoPair);
