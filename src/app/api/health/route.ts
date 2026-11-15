import { ready } from "@/server/auth";
import { row } from "@/server/database";
import { objectStoreReady } from "@/server/object-store";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await ready();
    await objectStoreReady();
    await row("SELECT 1 AS ok");
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
