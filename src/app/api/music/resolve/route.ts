import { account, route } from "@/server/http";
import { limitSpotifyRequests, resolveSpotifyLink } from "@/server/spotify";

export const GET = route(async (request) => {
  const current = await account(request);
  limitSpotifyRequests(current.id);
  return resolveSpotifyLink(new URL(request.url).searchParams.get("url") || "");
});
