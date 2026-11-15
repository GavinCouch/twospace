"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import type { Person } from "@/shared/types";
import "./person-avatar.css";

type AvatarPerson = Pick<Person, "id" | "name" | "color">;

export function avatarVariant(identity: string) {
  let hash = 0;
  for (const character of identity) {
    hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  }
  return hash % 2 ? "rose" : "ivory";
}

export function PersonAvatar({
  person,
  seed = "",
  size = 36,
  className = "",
}: {
  person?: AvatarPerson;
  seed?: string;
  size?: number;
  className?: string;
}) {
  const variant = avatarVariant(person?.id || seed);
  const src = `/artwork/avatar-${variant}.png`;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const accent =
    person?.color && /^#[0-9a-f]{6}$/i.test(person.color)
      ? person.color
      : variant === "rose"
        ? "#b78999"
        : "#b9ac9a";
  const fallback = person?.name.trim().slice(0, 1).toUpperCase() || "·";
  return (
    <span
      className={`person-avatar ${className}`.trim()}
      data-variant={variant}
      aria-hidden="true"
      style={
        {
          "--avatar-size": `${size}px`,
          "--avatar-accent": accent,
        } as CSSProperties
      }
    >
      {failedSource === src ? (
        <span className="person-avatar-fallback">{fallback}</span>
      ) : (
        <Image
          src={src}
          alt=""
          width={size}
          height={size}
          sizes={`${size}px`}
          onError={() => setFailedSource(src)}
        />
      )}
    </span>
  );
}
