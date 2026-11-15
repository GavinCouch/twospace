import { route } from "@/server/http";
import { getMedia } from "@/server/media";

export const GET = route((request, { id }) => getMedia(request, id, true));
export const HEAD = GET;
