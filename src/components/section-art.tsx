import Image from "next/image";

export type SectionArtName =
  "journal" | "activities" | "plans" | "music" | "settings" | "questions" | "drawing";

export function SectionArt({
  name,
  size = 32,
  className = "",
}: {
  name: SectionArtName;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={`/artwork/${name}.png`}
      width={size}
      height={size}
      sizes={`${size}px`}
      alt=""
      aria-hidden="true"
      className={`section-art ${className}`.trim()}
      style={{ width: size, height: size, flexShrink: 0, objectFit: "contain" }}
    />
  );
}
