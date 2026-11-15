import { route } from "@/server/http";
import { after } from "next/server";
import { finishMediaDeletions } from "@/server/media";
import {
  removeProfilePhoto,
  uploadProfilePhoto,
} from "@/server/profile-photos";

export const PUT = route(async (request) => {
  const result = await uploadProfilePhoto(request);
  after(() => finishMediaDeletions());
  return result;
});
export const DELETE = route(async (request) => {
  const result = await removeProfilePhoto(request);
  after(() => finishMediaDeletions());
  return result;
});
