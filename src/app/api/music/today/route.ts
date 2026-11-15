import { route } from "@/server/http";
import { saveTodaySong } from "@/server/music";

export const PUT = route(saveTodaySong);
