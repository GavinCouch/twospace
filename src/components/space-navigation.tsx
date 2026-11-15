"use client";

import Link, { useLinkStatus } from "next/link";
import type { CSSProperties } from "react";
import { SectionArt } from "./section-art";

const links = [
  { href: "/journal", name: "Journal", art: "journal" },
  { href: "/activities", name: "Activities", art: "activities" },
  { href: "/plans", name: "Plans", art: "plans" },
  { href: "/music", name: "Music", art: "music" },
  { href: "/settings", name: "Settings", art: "settings" },
] as const;

export function SpaceNavigation({
  path,
  mobile = false,
}: {
  path: string;
  mobile?: boolean;
}) {
  const items = mobile ? links : links.slice(0, -1);
  const active = items.findIndex((item) => path.startsWith(item.href));
  return (
    <nav
      className={mobile ? "mobile-navigation" : "primary-navigation"}
      aria-label={mobile ? "Mobile navigation" : "Main navigation"}
      data-active={active >= 0}
      style={
        {
          "--active-index": Math.max(0, active),
          "--nav-count": items.length,
        } as CSSProperties
      }
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={
            path.startsWith(item.href) ? "nav-link active" : "nav-link"
          }
          aria-current={path.startsWith(item.href) ? "page" : undefined}
        >
          <SectionArt name={item.art} size={30} />
          {item.name}
          <NavigationPending />
        </Link>
      ))}
    </nav>
  );
}

function NavigationPending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={`nav-pending${pending ? " is-pending" : ""}`}
    />
  );
}
