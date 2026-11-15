import { NextResponse, type NextRequest } from "next/server";

const previousHost = "twospace-cptv.onrender.com";
const canonicalOrigin = "https://twospace.online";
const pages = new Set([
  "/",
  "/journal",
  "/activities",
  "/plans",
  "/music",
  "/settings",
  "/forgot-password",
  "/reset-password",
  "/ios",
]);

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/\/$/, "") || "/";
  if (
    process.env.BETTER_AUTH_URL?.replace(/\/$/, "") !== canonicalOrigin ||
    request.headers.get("host")?.toLowerCase() !== previousHost ||
    !["GET", "HEAD"].includes(request.method) ||
    !pages.has(path)
  )
    return NextResponse.next();

  const destination = new URL(canonicalOrigin);
  destination.pathname = request.nextUrl.pathname;
  destination.search = request.nextUrl.search;
  return NextResponse.redirect(destination, 307);
}

export const config = {
  matcher: [
    "/",
    "/journal",
    "/activities",
    "/plans",
    "/music",
    "/settings",
    "/forgot-password",
    "/reset-password",
    "/ios",
  ],
};
