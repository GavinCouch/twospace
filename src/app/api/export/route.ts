import { route } from '@/server/http';
import { exportSnapshot } from '@/server/snapshot';
export const GET = route(exportSnapshot);
