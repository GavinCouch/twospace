"use client";

import { getImageProps } from "next/image";
import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import { SectionArt, type SectionArtName } from "@/components/section-art";

const previews = [
  {
    id: "journal",
    label: "Journal",
    title: "Notes, photos, and voice messages",
    description:
      "Add something from your day. Reply to each other’s entries and organize them into collections.",
    alt: "TwoSpace journal showing a note from Theo and Maya’s reply.",
  },
  {
    id: "activities",
    label: "Activities",
    title: "Play a game together",
    description:
      "Choose from four games and take your turn whenever you’re free. You don’t have to be online at the same time.",
    alt: "A Four-in-a-row match between Maya and Theo, showing the board and whose turn it is.",
  },
  {
    id: "music",
    label: "Music",
    title: "Pick a daily song",
    description:
      "Choose a Spotify track and leave a note. Listen in the player or open it in Spotify. Past picks stay in your space.",
    alt: "Maya and Theo’s daily song picks with personal notes and Spotify players.",
  },
  {
    id: "plans",
    label: "Plans",
    title: "Plans in both time zones",
    description:
      "Find a time for a call or an online activity. You can also plan visits when that’s an option.",
    alt: "Shared plans showing the same call in Chicago and London time, with a checklist.",
  },
] satisfies {
  id: SectionArtName;
  label: string;
  title: string;
  description: string;
  alt: string;
}[];

export function ProductPreview() {
  const [selected, setSelected] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const preview = previews[selected];
  const imageRoot = `/screenshots/home/${preview.id}`;
  const common = {
    alt: preview.alt,
    sizes:
      "(max-width: 640px) calc(100vw - 48px), (max-width: 1248px) calc(100vw - 80px), 1168px",
  };
  const { props: desktop } = getImageProps({
    ...common,
    src: `${imageRoot}-desktop.jpg`,
    width: 1120,
    height: 900,
  });
  const { props: mobile } = getImageProps({
    ...common,
    src: `${imageRoot}-mobile.jpg`,
    width: 390,
    height: 844,
  });

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, current: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (current + 1) % previews.length;
    else if (event.key === "ArrowLeft")
      next = (current + previews.length - 1) % previews.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = previews.length - 1;
    else return;
    event.preventDefault();
    setSelected(next);
    tabs.current[next]?.focus();
  }

  return (
    <section className="home-product" id="inside" aria-label="Explore TwoSpace">
      <div
        className="home-product-tabs"
        role="tablist"
        aria-label="Feature previews"
      >
        {previews.map((item, index) => (
          <button
            key={item.id}
            ref={(element) => {
              tabs.current[index] = element;
            }}
            type="button"
            id={`preview-tab-${item.id}`}
            role="tab"
            aria-selected={selected === index}
            aria-controls={`preview-panel-${item.id}`}
            tabIndex={selected === index ? 0 : -1}
            onClick={() => setSelected(index)}
            onKeyDown={(event) => moveTab(event, index)}
          >
            <SectionArt name={item.id} size={26} />
            {item.label}
          </button>
        ))}
      </div>
      <div
        className="home-product-panel"
        id={`preview-panel-${preview.id}`}
        role="tabpanel"
        aria-labelledby={`preview-tab-${preview.id}`}
        tabIndex={0}
      >
        <div className="home-product-description">
          <h2>{preview.title}</h2>
          <p>{preview.description}</p>
        </div>
        <figure>
          <div className="home-screen">
            <picture key={preview.id}>
              <source
                media="(max-width: 640px)"
                srcSet={mobile.srcSet}
                sizes={mobile.sizes}
                width={390}
                height={844}
              />
              <img
                {...desktop}
                loading="eager"
                fetchPriority={selected === 0 ? "high" : "auto"}
              />
            </picture>
          </div>
          <figcaption>
            <span>Screenshots from TwoSpace with fictional accounts.</span>
            <a
              className="home-screen-full-desktop"
              href={`${imageRoot}-desktop.jpg`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open full ${preview.label.toLowerCase()} screenshot in a new tab`}
            >
              View full size <ArrowUpRight size={14} aria-hidden="true" />
            </a>
            <a
              className="home-screen-full-mobile"
              href={`${imageRoot}-mobile.jpg`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open full ${preview.label.toLowerCase()} screenshot in a new tab`}
            >
              View full size <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </figcaption>
        </figure>
      </div>
      {previews.map((item, index) =>
        index === selected ? null : (
          <div
            key={item.id}
            id={`preview-panel-${item.id}`}
            role="tabpanel"
            aria-labelledby={`preview-tab-${item.id}`}
            hidden
          />
        ),
      )}
    </section>
  );
}
