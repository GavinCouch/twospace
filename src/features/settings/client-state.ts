import type { QueryClient } from "@tanstack/react-query";

const privateDraftPrefixes = ["twospace:journal-draft:"];

function removePrivateDrafts(storage: Storage) {
  for (let index = storage.length - 1; index >= 0; index--) {
    const key = storage.key(index);
    if (key && privateDraftPrefixes.some(prefix => key.startsWith(prefix))) storage.removeItem(key);
  }
}

export async function clearPrivateClientState(client: QueryClient): Promise<void> {
  // A failed cancellation must not keep the previous account's cached content.
  await client.cancelQueries().catch(() => undefined);
  if (typeof window !== "undefined") {
    for (const name of ["sessionStorage", "localStorage"] as const) {
      try { removePrivateDrafts(window[name]); } catch { /* Storage may be disabled by the browser. */ }
    }
  }
  client.clear();
}
