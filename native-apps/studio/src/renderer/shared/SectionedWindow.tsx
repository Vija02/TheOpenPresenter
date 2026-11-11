import { ComponentType, useEffect, useState } from "react";

export type Section = {
  id: string;
  label: string;
  hint: string;
  Component: ComponentType;
};

/** The section a hash names, or the first one. */
export function sectionFromHash<S extends Section>(
  sections: readonly S[],
  hash: string,
): S["id"] {
  const name = hash.replace(/^#/, "");
  return sections.find((section) => section.id === name)?.id ?? sections[0]!.id;
}

/** A window of sections with a sidebar, driven by the hash. */
export function SectionedWindow({
  sections,
  label,
}: {
  sections: readonly Section[];
  label: string;
}) {
  const [active, setActive] = useState(() =>
    sectionFromHash(sections, window.location.hash),
  );

  // The menu opens a section by changing the hash
  useEffect(() => {
    const onHashChange = () =>
      setActive(sectionFromHash(sections, window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [sections]);

  const { Component } = sections.find((section) => section.id === active)!;

  return (
    <div className="settings">
      <nav className="settings-nav" aria-label={label}>
        {sections.map((section) => (
          <button
            key={section.id}
            className="settings-nav-item"
            aria-current={section.id === active}
            onClick={() => {
              // Through the hash, so the menu can reopen the same section.
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
