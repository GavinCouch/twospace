import Image from "next/image";
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
      <Image
        src="/brand/logo-dark.png"
        width={36}
        height={36}
        sizes="36px"
        alt=""
      />
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
              <span>Your shared space</span>
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
              <h3>For when you wake up</h3>
              <p>
                Tell me how the interview goes. I’m making the same coffee as
                you.
              </p>
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
                <p>Our two sides of the day.</p>
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
      <figcaption>Product preview · example content</figcaption>
    </figure>
  );
}

function FourPreview() {
  const pieces: Record<number, string> = {
    30: "rose",
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
          className={pieces[index] ? `home-disc-${pieces[index]}` : undefined}
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
            <h1 id="home-heading">
              A shared space
              <br />
              for the two of you.
            </h1>
            <p>
              Notes, photos, daily songs, and things to do together. Made for
              couples sharing their lives from different places.
            </p>
            <div className="home-hero-actions">
              <Link className="button" href="/sign-up">
                Create your space
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <a className="home-explore" href="#inside">
                Take a look
                <ArrowDown size={16} aria-hidden="true" />
              </a>
            </div>
            <div className="home-privacy-note">
              <LockKeyhole size={14} aria-hidden="true" />
              <span>Shared with the person you invite.</span>
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
            <h2 id="home-journal-title">
              Notes, photos,
              <br />
              and voice messages.
            </h2>
            <p>
              Leave a note, send a photo, or record a voice message. Keep them
              together, with replies from your partner.
            </p>
            <ul className="home-detail-list">
              <li>Letters that open later</li>
              <li>Photo pairs from both your days</li>
              <li>Saved memories and drawings</li>
            </ul>
          </div>
          <figure className="home-journal-details">
            <div className="home-letter">
              <span>
                <LockKeyhole size={15} aria-hidden="true" />A note for later
              </span>
              <SectionArt name="journal" size={94} />
              <strong>Open on your birthday.</strong>
              <p>
                Your partner can read it
                <br />
                at the time you choose.
              </p>
            </div>
            <div className="home-voice">
              <PreviewPerson name="Theo" />
              <span className="home-voice-caption">
                A voice note for your evening
              </span>
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
            <figcaption>Product preview · example content</figcaption>
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
              <h3>A pick from your partner.</h3>
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
            <figcaption>Product preview · example note</figcaption>
          </figure>
          <div className="home-feature-copy">
            <span className="home-section-label">
              <SectionArt name="music" size={32} />
              Music
            </span>
            <h2 id="home-music-title">
              One song each.
              <br />A note to go with it.
            </h2>
            <p>
              Pick a Spotify song for the day and say why you chose it. Listen
              from the embedded player or open it in Spotify.
            </p>
            <p className="home-secondary-copy">
              Your past picks and notes stay in your space.
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
              <h2 id="home-activities-title">
                Games, questions,
                <br />
                and drawings.
              </h2>
            </div>
            <p>
              Take a turn now or come back later. You don’t have to be free at
              the same time.
            </p>
          </div>
          <div className="home-activities-body">
            <figure className="home-game-preview">
              <div className="home-game-heading">
                <span>Four in a row</span>
                <span>Theo’s turn</span>
              </div>
              <FourPreview />
              <figcaption>Product preview · example game</figcaption>
            </figure>
            <div className="home-activity-list">
              <div>
                <SectionArt name="questions" size={56} />
                <div>
                  <h3>Answer a question</h3>
                  <p>
                    Write your answers separately. Read them once you’ve both
                    replied.
                  </p>
                </div>
              </div>
              <div>
                <SectionArt name="activities" size={56} />
                <div>
                  <h3>Take your turn</h3>
                  <p>Play four in a row or trade clues in a word game.</p>
                </div>
              </div>
              <div>
                <SectionArt name="drawing" size={56} />
                <div>
                  <h3>Add to a drawing</h3>
                  <p>
                    Take turns adding to the same canvas and save what you make.
                  </p>
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
            <h2 id="home-plans-title">
              Find a time
              <br />
              that works for both.
            </h2>
            <p>
              Suggest a call or an activity, compare your usual free hours, and
              confirm a time in both time zones.
            </p>
            <p className="home-secondary-copy">
              Plan online time together, or an in-person visit when that’s an
              option.
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
            <figcaption>Product preview · example plan</figcaption>
          </figure>
        </section>

        <section
          id="getting-started"
          className="home-start"
          aria-labelledby="home-start-title"
        >
          <div className="home-start-heading">
            <h2 id="home-start-title">Start with an invitation.</h2>
            <Link className="button" href="/sign-up">
              Create your space
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <ol>
            <li>
              <span>01</span>
              <h3>Create your account</h3>
              <p>Give your shared space a name.</p>
            </li>
            <li>
              <span>02</span>
              <h3>Invite your partner</h3>
              <p>Send them an invitation to join you.</p>
            </li>
            <li>
              <span>03</span>
              <h3>Leave the first note</h3>
              <p>Or pick a song, a question, or a game.</p>
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
