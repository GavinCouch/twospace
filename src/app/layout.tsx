import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque/wght.css";
import "@fontsource-variable/figtree/wght.css";
import "./globals.css";
import { Providers } from "@/components/space-provider";

export const metadata: Metadata = {
  title: { default: "TwoSpace", template: "%s · TwoSpace" },
  description:
    "Share notes, photos, songs, games, and plans with your long-distance partner.",
};

export const viewport: Viewport = {
  themeColor: "#110f14",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
