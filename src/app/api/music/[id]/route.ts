import { route } from "@/server/http";
import { deleteSong } from "@/server/music";

export const DELETE = route((request, params) =>
  deleteSong(request, params.id),
);
