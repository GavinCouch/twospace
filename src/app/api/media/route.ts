import { route } from '@/server/http';
import { uploadMedia } from '@/server/media';
export const POST = route(uploadMedia);
