"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import type { Person } from "@/shared/types";
import "./person-avatar.css";

type AvatarPerson = Pick<Person, "id" | "name" | "color" | "avatarMediaId">;

export function PersonAvatar({
  person,
  size = 36,
  className = "",
}: {
  person?: AvatarPerson;
  size?: number;
  className?: string;
}) {
  const customPhoto = person?.avatarMediaId
    ? `/api/media/${encodeURIComponent(person.avatarMediaId)}`
    : null;
  const [failedSources, setFailedSources] = useState<Set<string>>(
    () => new Set(),
  );
  const src =
    customPhoto && !failedSources.has(customPhoto) ? customPhoto : null;
  const accent =
    person?.color && /^#[0-9a-f]{6}$/i.test(person.color)
      ? person.color
      : "#74797d";
  return (
    <span
      className={`person-avatar ${className}`.trim()}
      data-photo={src ? true : undefined}
      aria-hidden="true"
      style={
        {
          "--avatar-size": `${size}px`,
          "--avatar-accent": accent,
        } as CSSProperties
      }
    >
      {src ? (
        <Image
          src={src}
          alt=""
          width={size}
          height={size}
          sizes={`${size}px`}
          unoptimized
          onError={() =>
            setFailedSources((previous) => new Set([...previous, src]))
          }
        />
      ) : (
        <svg
          className="person-avatar-silhouette"
          viewBox="0 0 64 64"
          aria-hidden="true"
          focusable="false"
        >
          <ellipse cx="32" cy="23" rx="12" ry="13" />
          <path d="M8 64v-8c0-10 8-18 18-18h12c10 0 18 8 18 18v8Z" />
        </svg>
      )}
    </span>
  );
}
