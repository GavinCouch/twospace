const configured =
  process.env.EXPO_PUBLIC_API_URL || "https://twospace.online";
const url = new URL(configured);
const local = ["localhost", "127.0.0.1", "10.0.2.2"].includes(url.hostname);
if (url.protocol !== "https:" && !(__DEV__ && local))
  throw new Error("TwoSpace needs a secure server address.");
if (
  url.username ||
  url.password ||
  url.search ||
  url.hash ||
  !["", "/"].includes(url.pathname)
)
  throw new Error(
    "Use the TwoSpace server origin without a path or credentials.",
  );
export const API_URL = url.origin;
export const CALLBACK_URL = "twospace://auth/callback";
