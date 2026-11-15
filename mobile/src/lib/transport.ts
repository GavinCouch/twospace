export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function createTransport(
  origin: string,
  getCookie: () => string | Promise<string>,
  fetcher: typeof fetch = fetch,
) {
  return async function request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    if (
      !path.startsWith("/api/") ||
      path.includes("\\") ||
      new URL(path, origin).origin !== origin
    )
      throw new Error("Invalid API path.");
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (init.signal?.aborted) controller.abort();
    init.signal?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, 75_000);
    try {
      const headers = new Headers(init.headers);
      const cookie = await getCookie();
      if (cookie) headers.set("Cookie", cookie);
      headers.set("Accept", "application/json");
      if (typeof init.body === "string")
        headers.set("Content-Type", "application/json");
      const response = await fetcher(origin + path, {
        ...init,
        credentials: "omit",
        headers,
        signal: controller.signal,
        redirect: "error",
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
        code?: string;
      } | null;
      if (!response.ok)
        throw new ApiError(
          body?.error || body?.message || "This request couldn’t be completed.",
          response.status,
          body?.code,
        );
      if (body === null)
        throw new ApiError("The server sent an unreadable response.", 502);
      return body as T;
    } catch (error) {
      if (controller.signal.aborted && !init.signal?.aborted)
        throw new Error("The server is taking too long. Please try again.");
      throw error;
    } finally {
      clearTimeout(timeout);
      init.signal?.removeEventListener("abort", abort);
    }
  };
}
