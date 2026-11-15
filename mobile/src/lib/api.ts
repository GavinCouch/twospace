import { auth } from "./auth";
import { API_URL } from "./config";
import { createTransport } from "./transport";
export { ApiError } from "./transport";
export const api = createTransport(API_URL, () => auth.getCookie() || "");
export const post = <T>(path: string, body: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
