import { ready } from "@/server/auth";
import { objectStoreReady } from "@/server/object-store";
import { finishMediaDeletions } from "@/server/media";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await ready();
    await objectStoreReady();
    await finishMediaDeletions();
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { ok: false, error: "The service is not ready." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
