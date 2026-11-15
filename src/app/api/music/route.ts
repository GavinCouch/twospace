import { route } from "@/server/http";
import { getMusic } from "@/server/music";

export const GET = route(getMusic);
