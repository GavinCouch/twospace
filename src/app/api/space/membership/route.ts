import { after } from "next/server";
import { route } from "@/server/http";
import { finishMediaDeletions } from "@/server/media";
import { leaveSpace } from "@/server/spaces";

export const DELETE = route(async (request) => {
  const result = await leaveSpace(request);
  after(() => finishMediaDeletions());
  return result;
});
