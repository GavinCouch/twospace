import { route } from "@/server/http";
import {
  removeProfilePhoto,
  uploadProfilePhoto,
} from "@/server/profile-photos";

export const PUT = route(uploadProfilePhoto);
export const DELETE = route(removeProfilePhoto);
