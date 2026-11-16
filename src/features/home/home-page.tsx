import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import logo from "../../../public/brand/logo-dark.png";
import { IphoneAppLink } from "@/components/iphone-app-link";
import { SectionArt } from "@/components/section-art";
import { ProductPreview } from "./product-preview";
import "./home.css";

function HomeBrand() {
  return (
    <span className="home-brand">
      <Image src={logo} width={36} height={36} sizes="36px" alt="" />
      <span>TwoSpace</span>
    </span>
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
          <a href="#inside">Features</a>
          <a href="#getting-started">How it works</a>
        </nav>
        <div className="home-account-links">
          <Link className="home-sign-in" href="/sign-in">
            Sign in
          </Link>
          <Link className="button home-header-create" href="/sign-up">
            Create an account
          </Link>
        </div>
      </header>
      <main id="home-main">
        <section className="home-hero" aria-labelledby="home-heading">
          <div className="home-hero-lead">
            <h1 id="home-heading">A shared space for long-distance couples.</h1>
          </div>
          <div className="home-hero-copy">
            <p>
              Leave a note, share today’s song, or play a round together. Keep
              your plans in both time zones.
            </p>
            <div className="home-hero-actions">
              <Link className="button" href="/sign-up">
                Create an account <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <Link className="secondary" href="/sign-in">
                Sign in
              </Link>
            </div>
            <p className="home-pairing-note">
              Connect with your partner using an invite code.
            </p>
          </div>
        </section>

        <ProductPreview />

        <section className="home-more" aria-labelledby="home-more-heading">
          <h2 id="home-more-heading">Questions, drawings, and letters</h2>
          <div className="home-more-grid">
            <article className="home-feature-card">
              <SectionArt name="questions" size={40} />
              <h3>Answer the same question</h3>
              <p>
                Write your answers separately. Read them once you’ve both
                replied.
              </p>
            </article>
            <article className="home-feature-card">
              <SectionArt name="drawing" size={40} />
              <h3>Draw together</h3>
              <p>
                Take turns on a shared canvas, then save the drawing to your
                journal.
              </p>
            </article>
            <article className="home-feature-card">
              <SectionArt name="journal" size={40} />
              <h3>Schedule a letter</h3>
              <p>
                Write something now and choose when your partner can open it.
              </p>
            </article>
          </div>
        </section>

        <section
          id="getting-started"
          className="home-start"
          aria-labelledby="home-start-heading"
        >
          <div className="home-start-heading">
            <h2 id="home-start-heading">Set up your space</h2>
            <p>
              The shared features become available once you’re both in.
            </p>
          </div>
          <ol>
            <li>
              <span>1</span>
              <div>
                <h3>Create your account</h3>
                <p>
                  Make a space, or join the one your partner has already made.
                </p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <h3>Share the invite code</h3>
                <p>
                  Your partner enters the code from their account to join you.
                </p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <h3>Add your first entry</h3>
                <p>
                  Post in the journal, pick today’s song, start a game, or
                  suggest a time for your next call.
                </p>
              </div>
            </li>
          </ol>
          <Link className="button" href="/sign-up">
            Create an account <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
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
            Made by Gavin Couch <ArrowUpRight size={13} aria-hidden="true" />
          </a>
        </div>
        <nav aria-label="Footer">
          <IphoneAppLink />
          <Link href="/sign-in">Sign in</Link>
          <a
            href="https://github.com/GavinCouch/twospace"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </nav>
      </footer>
    </div>
  );
}
