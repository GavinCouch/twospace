"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { SpaceSnapshot } from "@/shared/types";
import { formatInZone } from "@/shared/time";
import { SectionArt } from "@/components/section-art";
import { PhotoPairs } from "./photo-pairs";

export function JournalSidebar({ space }: { space: SpaceSnapshot }) {
  const question = space.questions.find((item) => !item.complete);
  const plan = [...space.plans]
    .filter(
      (item) =>
        item.status !== "done" && Date.parse(item.startsAt) >= Date.now(),
    )
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
  const answered = question?.answers.some(
    (answer) => answer.userId === space.me.id,
  );
  return (
    <aside className="journal-sidebar" aria-label="Together">
      <section className="journal-question-preview">
        <div className="sidebar-card-label">
          <SectionArt name="questions" size={30} />
          <span>{question ? "An open question" : "Questions"}</span>
        </div>
        <h2>{question?.prompt || "Pick a question to answer together"}</h2>
        <Link href="/activities?tab=questions" className="sidebar-card-link">
          {question
            ? answered
              ? "See your answer"
              : "Answer question"
            : "Choose a question"}
          <ArrowUpRight size={17} />
        </Link>
      </section>
      <PhotoPairs
        key={space.me.id}
        pairs={space.photoPairs}
        members={space.members}
        me={space.me}
      />
      {plan && (
        <section className="journal-plan-preview">
          <div className="sidebar-card-label">
            <SectionArt name="plans" size={30} />
            <span>Next plan</span>
          </div>
          <h2>{plan.title}</h2>
          <p>{formatInZone(plan.startsAt, space.me.timeZone)}</p>
          <Link href="/plans" className="sidebar-card-link">
            View plan
            <ArrowUpRight size={17} />
          </Link>
        </section>
      )}
    </aside>
  );
}
