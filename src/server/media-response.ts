/** Serve already-authorized media, including the small probes used by native players. */
export function createMediaResponse(
  request: Request,
  buffer: Buffer,
  suppliedHeaders: HeadersInit,
): Response {
  const headers = new Headers(suppliedHeaders);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", String(buffer.length));
  headers.delete("Content-Range");

  if (request.method === "HEAD") return new Response(null, { headers });

  // There are no validators for these private files. An If-Range condition
  // therefore cannot be verified, so send the complete representation.
  const range =
    request.method === "GET" && !request.headers.has("if-range")
      ? request.headers.get("range")?.trim()
      : null;
  const match = range?.match(/^bytes=(\d*)-(\d*)$/i);
  if (match && (match[1] || match[2])) {
    // Parse before converting to Number so an oversized offset cannot wrap or
    // round into an apparently valid byte position.
    const size = BigInt(buffer.length);
    const first = match[1] ? BigInt(match[1]) : null;
    const last = match[2] ? BigInt(match[2]) : null;
    if (first === null || last === null || first <= last) {
      const start = first ?? (last! >= size ? 0n : size - last!);
      const end =
        first === null || last === null || last >= size ? size - 1n : last;
      if (start >= size || size === 0n) {
        headers.set("Content-Range", `bytes */${buffer.length}`);
        headers.set("Content-Length", "0");
        return new Response(null, { status: 416, headers });
      }
      headers.set("Content-Range", `bytes ${start}-${end}/${buffer.length}`);
      headers.set("Content-Length", String(end - start + 1n));
      return new Response(
        Uint8Array.from(buffer.subarray(Number(start), Number(end) + 1)),
        { status: 206, headers },
      );
    }
  }

  // Unsupported units, malformed ranges, and multipart requests may be
  // ignored. A normal 200 response is preferable to a misleading partial one.
  return new Response(Uint8Array.from(buffer), { headers });
}
