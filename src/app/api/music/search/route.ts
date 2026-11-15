import { pairedContext, route } from "@/server/http";
import { limitSpotifyRequests, searchSpotify } from "@/server/spotify";

export const GET = route(async (request) => {
  const ctx = await pairedContext(request);
  limitSpotifyRequests(ctx.account.id);
  return {
    tracks: await searchSpotify(
      new URL(request.url).searchParams.get("q") || "",
    ),
  };
});
