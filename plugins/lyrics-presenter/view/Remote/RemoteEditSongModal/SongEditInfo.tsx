import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui";
import { ReactNode } from "react";
import { FaCircleInfo } from "react-icons/fa6";

const Example = ({ children }: { children: ReactNode }) => (
  <pre className="mt-2 rounded border border-stroke bg-surface-secondary px-3 py-2 font-mono text-xs whitespace-pre-wrap">
    {children}
  </pre>
);

const Rule = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="border-b border-stroke pb-4 last:border-b-0 last:pb-0">
    <h4 className="text-sm font-semibold">{title}</h4>
    <div className="mt-1 text-sm text-secondary">{children}</div>
  </section>
);

export const SongEditInfo = () => {
  return (
    <Sheet>
      <SheetTrigger
        render={<Button size="xs" variant="outline" className="font-light" />}
      >
        <FaCircleInfo className="text-gray-700" />
        <span className="md:hidden">Help</span>
        <span className="hidden md:inline">How does this work?</span>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="border-b border-stroke">
          <SheetTitle>Formatting songs</SheetTitle>
        </SheetHeader>

        <div className="stack-col min-h-0 flex-1 items-stretch gap-4 overflow-y-auto p-4">
          <Rule title="Sections">
            Put the section name in square brackets on its own line. It can be
            anything you like: Verse 1, Chorus, Bridge, Tag.
            <Example>{"[Verse 1]\nAmazing grace how sweet the sound"}</Example>
          </Rule>

          <Rule title="Splitting a section into slides">
            A line with a single dash starts a new slide in the same section.
            <Example>
              {
                "[Verse 1]\nAmazing grace how sweet the sound\n-\nThat saved a wretch like me"
              }
            </Example>
          </Rule>

          <Rule title="Chords">
            Chords go inline in square brackets where they need to be. This is
            the ChordPro format which keeps your chords aligned.
            <Example>{"[G]Amazing [C]grace how [D]sweet the sound"}</Example>
          </Rule>

          <Rule title="Chord lines">
            For chords that are above the lines, prefix the line with a dot.
            This indicates that the whole line are for chords.
            <Example>{"[Intro]\n.| D /// | Em / D / | G /// |"}</Example>
          </Rule>

          <Rule title="Chords on screen">
            Chords are for the people on stage. They don't show up on the
            projected slides.
          </Rule>
        </div>
      </SheetContent>
    </Sheet>
  );
};
