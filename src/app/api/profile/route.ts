import { route } from '@/server/http';
import { updateProfile } from '@/server/spaces';
export const PATCH = route(updateProfile);
