import type { Metadata } from "next";
export const metadata: Metadata = { title: "TwoSpace", description: "Your shared journal, activities, and plans." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
