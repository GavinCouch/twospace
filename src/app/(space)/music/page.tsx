import type { Metadata } from "next";
import MusicPage from "@/features/music/music-page";

export const metadata: Metadata = { title: "Music · TwoSpace" };
export default function Page() { return <MusicPage />; }
