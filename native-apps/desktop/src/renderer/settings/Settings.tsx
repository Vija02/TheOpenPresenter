import { useEffect, useState } from "react";

import { About } from "./About";
import { Account } from "./Account";
import { RemoteAccess } from "./RemoteAccess";
import { RuntimeManager } from "./RuntimeManager";

export const SECTIONS = [
  {
    id: "server",
    label: "Account",
    hint: "Your instance and organizations",
    Component: Account,
  },
  {
    id: "runtime",
    label: "Local runtime",
    hint: "The instance that runs on this computer",
    Component: RuntimeManager,
  },
  {
    id: "remote",
    label: "Remote access",
    hint: "Reach this computer from elsewhere",
    Component: RemoteAccess,
  },
  {
    id: "about",
    label: "About",
    hint: "Versions and support",
    Component: About,
  },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

const DEFAULT_SECTION: SectionId = "server";

export function sectionFromHash(hash: string): SectionId {
  const name = hash.replace(/^#/, "");
  return SECTIONS.some((section) => section.id === name)
    ? (name as SectionId)
    : DEFAULT_SECTION;
}

export function Settings() {
  const [active, setActive] = useState<SectionId>(() =>
    sectionFromHash(window.location.hash),
  );

  // The menu opens this window by changing the hash
  useEffect(() => {
    const onHashChange = () => setActive(sectionFromHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const current = SECTIONS.find((section) => section.id === active)!;
  const { Component } = current;

  return (
    <div className="settings">
      <nav className="settings-nav" aria-label="Settings sections">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            className="settings-nav-item"
            aria-current={section.id === active}
            onClick={() => {
              // Through the hash so the window's URL keeps describing what it
              // is showing, and the menu can reopen the same section.
              window.location.hash = section.id;
            }}
          >
            <span className="settings-nav-label">{section.label}</span>
            <span className="settings-nav-hint">{section.hint}</span>
          </button>
        ))}
      </nav>

      <main className="settings-pane">
        <Component key={active} />
      </main>
    </div>
  );
}
