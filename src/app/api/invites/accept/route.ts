import { route } from '@/server/http';
import { acceptInvite } from '@/server/spaces';
export const POST = route(acceptInvite);
