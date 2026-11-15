"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import type { Person } from "@/shared/types";
import "./person-avatar.css";

type AvatarPerson = Pick<Person, "id" | "name" | "color" | "avatarMediaId">;

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
  const artwork = `/artwork/avatar-${variant}.png`;
  const customPhoto = person?.avatarMediaId
    ? `/api/media/${encodeURIComponent(person.avatarMediaId)}`
    : null;
  const [failedSources, setFailedSources] = useState<Set<string>>(
    () => new Set(),
  );
  const src =
    customPhoto && !failedSources.has(customPhoto) ? customPhoto : artwork;
  const isPhoto = src === customPhoto;
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
      data-photo={isPhoto || undefined}
      aria-hidden="true"
      style={
        {
          "--avatar-size": `${size}px`,
          "--avatar-accent": accent,
        } as CSSProperties
      }
    >
      {failedSources.has(src) ? (
        <span className="person-avatar-fallback">{fallback}</span>
      ) : (
        <Image
          src={src}
          alt=""
          width={size}
          height={size}
          sizes={`${size}px`}
          unoptimized={isPhoto}
          onError={() =>
            setFailedSources((previous) => new Set([...previous, src]))
          }
        />
      )}
    </span>
  );
}
