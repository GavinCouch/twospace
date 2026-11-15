"use client";
import Link from "next/link";
import Image from "next/image";

import { useSpace } from "@/components/space-provider";
import { ProfileSettings } from "./profile-settings";
import { SpaceSettings } from "./space-settings";
import { AccountActions } from "./account-actions";
import "./settings.css";

export default function SettingsPage() {
  const query = useSpace();
  return (
    <div className="settings-page">
      <div className="page-title">
        <h1>Settings</h1>
      </div>
      {query.isPending ? (
        <p role="status">Loading settings…</p>
      ) : query.error ? (
        <div>
          <p className="form-error" role="alert">
            {query.error.message}
          </p>
          <button className="secondary" onClick={() => void query.refetch()}>
            Try again
          </button>
        </div>
      ) : query.data ? (
        <div className="settings-sections">
          <ProfileSettings key={query.data.me.id} person={query.data.me} />
          <SpaceSettings
            key={query.data.space.id}
            name={query.data.space.name}
          />
          <section
            className="settings-section settings-iphone"
            aria-labelledby="iphone-settings-title"
          >
            <Image
              src="/brand/logo-dark.png"
              width={56}
              height={56}
              sizes="56px"
              alt=""
            />
            <div>
              <h2 id="iphone-settings-title">TwoSpace for iPhone</h2>
              <p>In development. Available soon.</p>
              <Link className="secondary" href="/ios">
                About the iPhone app
              </Link>
            </div>
          </section>
          <AccountActions space={query.data} />
        </div>
      ) : null}
    </div>
  );
}
