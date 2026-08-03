import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui";
import { ReactNode } from "react";

/** Structural wrappers: the collapsible groups and the label/control rows. */

export const Section = ({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) => (
  <Accordion
    type="single"
    collapsible
    defaultValue={defaultOpen ? "section" : undefined}
    className="border-b border-stroke last:border-b-0"
  >
    <AccordionItem value="section" className="border-none">
      <AccordionTrigger className="py-2 text-xs font-semibold uppercase tracking-wide text-secondary hover:no-underline">
        {title}
      </AccordionTrigger>
      <AccordionContent>
        <div className="flex flex-col gap-2 pb-3">{children}</div>
      </AccordionContent>
    </AccordionItem>
  </Accordion>
);

export const Row = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="grid grid-cols-[70px_1fr] items-center gap-2">
    <span className="text-xs text-secondary">{label}</span>
    {children}
  </div>
);

/**
 * Single-letter label variant
 */
export const MiniRow = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="grid grid-cols-[16px_1fr] items-center gap-1.5">
    <span className="text-xs text-secondary">{label}</span>
    {children}
  </div>
);
