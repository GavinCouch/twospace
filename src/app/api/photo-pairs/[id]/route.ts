import { route } from '@/server/http';
import { contributePhoto } from '@/server/entries';
export const POST = route((request, { id }) => contributePhoto(request, id));
