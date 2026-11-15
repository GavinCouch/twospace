import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/space-provider";
export const metadata: Metadata = { title: "TwoSpace", description: "Your shared journal, activities, and plans." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Providers>{children}</Providers></body></html>;
}
