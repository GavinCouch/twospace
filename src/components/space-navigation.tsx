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
  locked = false,
}: {
  path: string;
  mobile?: boolean;
  locked?: boolean;
}) {
  const items = mobile ? links : links.slice(0, -1);
  const active = items.findIndex(
    (item) =>
      path.startsWith(item.href) && (!locked || item.href === "/settings"),
  );
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
      {items.map((item) =>
        locked && item.href !== "/settings" ? (
          <span
            key={item.href}
            className="nav-link nav-link-locked"
            aria-disabled="true"
            title="Available when your partner joins"
          >
            <SectionArt name={item.art} size={30} />
            {item.name}
          </span>
        ) : (
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
        ),
      )}
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
