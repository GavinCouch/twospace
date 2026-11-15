import { pairedContext, route } from "@/server/http";
import { limitSpotifyRequests, resolveSpotifyLink } from "@/server/spotify";

export const GET = route(async (request) => {
  const ctx = await pairedContext(request);
  limitSpotifyRequests(ctx.account.id);
  return resolveSpotifyLink(new URL(request.url).searchParams.get("url") || "");
});
