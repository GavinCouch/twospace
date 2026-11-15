import { route } from '@/server/http';
import { getSnapshot } from '@/server/snapshot';
import { renameSpace } from '@/server/spaces';
export const GET = route(getSnapshot);
export const PATCH = route(renameSpace);
