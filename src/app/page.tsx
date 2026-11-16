import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { headers } from "next/headers";
import HomePage from "@/features/home/home-page";
import { hasWebSession } from "@/server/web-session";

export const metadata: Metadata = {
  title: { absolute: "TwoSpace" },
  description:
    "A shared space for long-distance couples. Share notes, photos, and daily songs, play games, and make plans across time zones.",
};

export default async function Home() {
  if (await hasWebSession(await headers())) redirect("/journal");
  return <HomePage />;
}
