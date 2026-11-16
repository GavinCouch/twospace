import Image from "next/image";
import logo from "../../../public/brand/logo-dark.png";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Heart,
  LockKeyhole,
  MessageCircle,
  Mic,
} from "lucide-react";
import { IphoneAppLink } from "@/components/iphone-app-link";
import { SectionArt } from "@/components/section-art";
import "./home.css";

function HomeBrand() {
  return (
    <span className="home-brand">
      <Image src={logo} width={36} height={36} sizes="36px" alt="" />
      <span>TwoSpace</span>
    </span>
  );
}

const previewProfiles = {
  Theo: "/artwork/home/theo.webp",
  Maya: "/artwork/home/maya.webp",
} as const;

function PreviewPerson({ name }: { name: keyof typeof previewProfiles }) {
  return (
    <span className="home-preview-person">
      <Image
        src={previewProfiles[name]}
        width={28}
        height={28}
        sizes="28px"
        alt=""
      />
      <strong>{name}</strong>
    </span>
  );
}

function JournalPreview() {
  return (
    <figure className="home-hero-preview">
      <div
        className="home-app-preview"
        aria-label="Example of a shared TwoSpace journal"
      >
        <div className="home-preview-toolbar">
          <HomeBrand />
          <span className="home-preview-tab">
            <SectionArt name="journal" size={20} />
            Journal
          </span>
          <SectionArt name="activities" size={22} />
          <SectionArt name="plans" size={22} />
        </div>
        <div className="home-preview-content">
          <div className="home-preview-space">
            <div>
              <span>Sunday, November 22</span>
              <h2>Theo &amp; Maya</h2>
            </div>
            <div className="home-preview-times">
              <span>
                9:15 am<small>Chicago</small>
              </span>
              <span>
                3:15 pm<small>London</small>
              </span>
            </div>
          </div>
          <div className="home-preview-feed">
            <div className="home-preview-note">
              <PreviewPerson name="Maya" />
              <h3>Good luck today</h3>
              <p>Call me after the interview? I want to hear how it went.</p>
              <div className="home-preview-reaction">
                <Heart size={13} fill="currentColor" aria-hidden="true" />
                <span>Heart sent</span>
                <MessageCircle size={13} aria-hidden="true" />
                <span>1 reply</span>
              </div>
            </div>
            <div className="home-preview-photo">
              <Image
                src="/brand/cover.png"
                width={2172}
                height={724}
                sizes="640px"
                alt="Illustration of two rooms, one in daylight and one at night"
              />
              <div>
                <PreviewPerson name="Theo" />
                <p>My morning, your afternoon.</p>
              </div>
            </div>
          </div>
          <div className="home-preview-next">
            <SectionArt name="plans" size={29} />
            <span>
              <strong>Coffee and a call</strong>
              <small>Sunday · 9 am for Theo, 3 pm for Maya</small>
            </span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </div>
        </div>
      </div>
      <figcaption>Example journal · fictional profiles</figcaption>
    </figure>
  );
}

function FourPreview() {
  const pieces: Record<number, string> = {
    24: "rose drop",
    30: "rose",
    31: "ivory",
    36: "ivory",
    37: "ivory",
    38: "rose",
    39: "rose",
    40: "ivory",
  };
  return (
    <div
      className="home-four-board"
      role="img"
      aria-label="Example of a four-in-a-row game, with pink and blue pieces"
    >
      {Array.from({ length: 42 }, (_, index) => (
        <span
          key={index}
          className={
            pieces[index]
              ? pieces[index]
                  .split(" ")
                  .map((name) => `home-disc-${name}`)
                  .join(" ")
              : undefined
          }
        />
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="home-page">
      <a className="home-skip" href="#home-main">
        Skip to content
      </a>
      <header className="home-header">
        <Link href="/" aria-label="TwoSpace home">
          <HomeBrand />
        </Link>
        <nav className="home-nav" aria-label="About TwoSpace">
          <a href="#inside">Inside TwoSpace</a>
          <a href="#getting-started">Getting started</a>
        </nav>
        <div className="home-account-links">
          <Link className="home-sign-in" href="/sign-in">
            Sign in
          </Link>
          <Link className="button home-header-create" href="/sign-up">
            Create your space
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </header>
      <main id="home-main">
        <section className="home-hero" aria-labelledby="home-heading">
          <div className="home-hero-copy">
            <span className="home-eyebrow">
              <i className="home-dot home-dot-rose" />
              <i className="home-dot home-dot-sky" />
              For two people in different places
            </span>
            <h1 id="home-heading">
              Close, even when you’re{" "}
              <span className="home-gradient-text">far apart.</span>
            </h1>
            <p>
              TwoSpace is a private corner of the internet for just the two of
              you: a shared journal, games that wait for your turn, a song a
              day, and plans that make sense on both clocks.
            </p>
            <div className="home-hero-actions">
              <Link className="button" href="/sign-up">
                Create your space
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <a className="home-explore" href="#inside">
                See what’s inside
                <ArrowDown size={16} aria-hidden="true" />
              </a>
            </div>
            <div className="home-privacy-note">
              <LockKeyhole size={14} aria-hidden="true" />
              <span>
                Private by design. Only the two of you, joined by an invite
                code.
              </span>
            </div>
          </div>
          <JournalPreview />
        </section>

        <section
          id="inside"
          className="home-journal home-feature"
          aria-labelledby="home-journal-title"
        >
          <div className="home-feature-copy">
            <span className="home-section-label">
              <SectionArt name="journal" size={32} />
              Journal
            </span>
            <h2 id="home-journal-title">A journal you keep together</h2>
            <p>
              Drop in a thought, a photo, or a voice note from your day. They
              can reply, send a heart, or tuck it into a collection for later.
            </p>
            <ul className="home-detail-list">
              <li>Write a letter that only opens on the day you choose</li>
              <li>Snap the same photo prompt and see both side by side</li>
              <li>Keep every photo and recording in one place</li>
            </ul>
          </div>
          <figure className="home-journal-details">
            <div className="home-letter">
              <span>
                <LockKeyhole size={15} aria-hidden="true" />A note for later
              </span>
              <SectionArt name="journal" size={94} />
              <strong>For your birthday</strong>
              <p>Opens December 8 at 9:00 am.</p>
            </div>
            <div className="home-voice">
              <PreviewPerson name="Theo" />
              <span className="home-voice-caption">On my way home</span>
              <div className="home-voice-wave" aria-hidden="true">
                <Mic size={18} />
                {[9, 19, 13, 26, 33, 17, 23, 12, 29, 36, 22, 14, 24, 16, 9].map(
                  (height, index) => (
                    <i key={index} style={{ height }} />
                  ),
                )}
                <span>0:28</span>
              </div>
            </div>
            <figcaption className="sr-only">
              Example letter and voice note
            </figcaption>
          </figure>
        </section>

        <section
          className="home-music home-feature"
          aria-labelledby="home-music-title"
        >
          <figure className="home-music-preview">
            <div className="home-music-art">
              <SectionArt name="music" size={222} />
            </div>
            <div className="home-song-note">
              <span>Today’s song</span>
              <h3>Maya’s pick</h3>
              <p>
                “For your walk home. Tell me what you think of the last verse.”
              </p>
              <div>
                <Image
                  src="/spotify-logo.svg"
                  width={82}
                  height={25}
                  alt="Spotify"
                />
                <span>
                  Open in Spotify
                  <ArrowUpRight size={14} aria-hidden="true" />
                </span>
              </div>
            </div>
            <figcaption className="sr-only">Example song note</figcaption>
          </figure>
          <div className="home-feature-copy">
            <span className="home-section-label">
              <SectionArt name="music" size={32} />
              Music
            </span>
            <h2 id="home-music-title">One song a day, picked for them</h2>
            <p>
              Choose a track, add a line about why, and let them hear it on
              their walk home. Every pick stays in your space, so it becomes a
              soundtrack of your time apart.
            </p>
          </div>
        </section>

        <section
          className="home-activities"
          aria-labelledby="home-activities-title"
        >
          <div className="home-activities-heading">
            <div>
              <span className="home-section-label">
                <SectionArt name="activities" size={32} />
                Activities
              </span>
              <h2 id="home-activities-title">Games that wait for your turn</h2>
            </div>
            <p>
              Make your move over lunch. They make theirs before bed. Or play
              live, side by side on a call.
            </p>
          </div>
          <div className="home-activities-body">
            <figure className="home-game-preview">
              <div className="home-game-heading">
                <span>Four-in-a-row · Move 7</span>
                <span className="home-turn-pill">Theo’s move</span>
              </div>
              <FourPreview />
              <figcaption className="sr-only">
                Example four-in-a-row game
              </figcaption>
            </figure>
            <div className="home-activity-list">
              <div>
                <SectionArt name="questions" size={56} />
                <div>
                  <h3>Answer the same question</h3>
                  <p>
                    Write your answers on your own. Neither of you sees the
                    other’s until you’ve both replied.
                  </p>
                </div>
              </div>
              <div>
                <SectionArt name="activities" size={56} />
                <div>
                  <h3>Challenge each other</h3>
                  <p>
                    Four-in-a-row, tic-tac-toe, rock paper scissors, and Three
                    clues, with a running score so nobody forgets who’s ahead.
                  </p>
                </div>
              </div>
              <div>
                <SectionArt name="drawing" size={56} />
                <div>
                  <h3>Draw something together</h3>
                  <p>Pass a shared canvas back and forth, one turn each.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="home-plans home-feature"
          aria-labelledby="home-plans-title"
        >
          <div className="home-feature-copy">
            <span className="home-section-label">
              <SectionArt name="plans" size={32} />
              Plans
            </span>
            <h2 id="home-plans-title">Plans that make sense on both clocks</h2>
            <p>
              See when your free hours overlap, suggest a time, and both of you
              see it in your own time zone. Add a checklist so nothing gets
              forgotten.
            </p>
            <p className="home-secondary-copy">
              A call, a movie night online, or a visit whenever one is on the
              cards.
            </p>
          </div>
          <figure className="home-plan-preview">
            <div className="home-plan-top">
              <span className="home-plan-date">
                NOV<strong>22</strong>
              </span>
              <div>
                <span>Call · 45 min</span>
                <h3>Coffee and a call</h3>
              </div>
              <span className="home-confirmed">
                <Check size={12} aria-hidden="true" />
                Confirmed
              </span>
            </div>
            <div className="home-plan-times">
              <div>
                <PreviewPerson name="Theo" />
                <strong>9:00 am</strong>
                <span>Sunday · Chicago</span>
              </div>
              <div>
                <PreviewPerson name="Maya" />
                <strong>3:00 pm</strong>
                <span>Sunday · London</span>
              </div>
            </div>
            <div className="home-plan-checklist">
              <span>
                <Check size={12} aria-hidden="true" />
              </span>
              Pick a coffee to try
            </div>
            <figcaption className="sr-only">Example call plan</figcaption>
          </figure>
        </section>

        <section
          id="getting-started"
          className="home-start"
          aria-labelledby="home-start-title"
        >
          <div className="home-start-heading">
            <h2 id="home-start-title">Ready when you two are</h2>
            <Link className="button" href="/sign-up">
              Create your space
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <ol>
            <li>
              <span>01</span>
              <h3>Make your space</h3>
              <p>
                Sign up and give it a name, or join the one your partner made.
              </p>
            </li>
            <li>
              <span>02</span>
              <h3>Send them the code</h3>
              <p>
                Share your private invite. Everything opens once you’re both in.
              </p>
            </li>
            <li>
              <span>03</span>
              <h3>Say hello</h3>
              <p>Leave the first note, pick today’s song, or start a game.</p>
            </li>
          </ol>
        </section>
      </main>
      <footer className="home-footer">
        <div>
          <Link href="/" aria-label="TwoSpace home">
            <HomeBrand />
          </Link>
          <a
            href="https://github.com/GavinCouch"
            target="_blank"
            rel="noopener noreferrer"
          >
            Made by Gavin Couch
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </div>
        <nav aria-label="Footer">
          <IphoneAppLink />
          <Link href="/sign-in">Sign in</Link>
          <a
            href="https://github.com/GavinCouch"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </nav>
      </footer>
    </div>
  );
}
