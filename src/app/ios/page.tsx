import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Brand } from "@/components/account-gate";
import { SectionArt } from "@/components/section-art";
import "./ios.css";

export const metadata: Metadata = {
  title: "TwoSpace for iPhone",
  description:
    "The TwoSpace iPhone app is in development and will be available soon.",
};

export default function IosPage() {
  return (
    <main className="ios-page">
      <header className="ios-header">
        <Link href="/" aria-label="TwoSpace home">
          <Brand />
        </Link>
        <Link className="secondary" href="/journal">
          Open TwoSpace
        </Link>
      </header>
      <section className="ios-intro" aria-labelledby="ios-title">
        <div className="ios-app-mark">
          <Image
            src="/brand/logo-dark.png"
            width={104}
            height={104}
            sizes="104px"
            alt=""
          />
        </div>
        <span className="ios-status">In development</span>
        <h1 id="ios-title">TwoSpace for iPhone</h1>
        <p>The iPhone app is in development and will be available soon.</p>
        <p className="muted">
          Use TwoSpace in your browser for now. Your account and shared space
          will work in the app, too.
        </p>
        <Link className="button" href="/journal">
          Continue on the web
        </Link>
      </section>
      <section className="ios-features" aria-label="In the companion app">
        <article>
          <SectionArt name="journal" size={68} />
          <h2>Journal</h2>
          <p>
            Leave a note, share a photo, and see what your partner has added.
          </p>
        </article>
        <article>
          <SectionArt name="activities" size={68} />
          <h2>Activities</h2>
          <p>Answer a question together or take your turn in a game.</p>
        </article>
        <article>
          <SectionArt name="plans" size={68} />
          <h2>Plans</h2>
          <p>
            Arrange a call or an activity, with times shown in your own time
            zone.
          </p>
        </article>
      </section>
      <footer className="ios-footer">
        An App Store release date has not been announced.
      </footer>
    </main>
  );
}
