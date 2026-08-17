import type { Template } from "@repo/layout";
import { LayoutRenderer } from "@repo/layout/react";
import { cn } from "@repo/ui";

export type LayoutPickerProps = {
  templates: Template[];
  activeId: string | null;
  onSelect: (templateId: string) => void;
};

export const LayoutPicker = ({
  templates,
  activeId,
  onSelect,
}: LayoutPickerProps) => (
  <div
    className="flex gap-2 p-2 flex-row overflow-x-auto desktop:flex-col desktop:overflow-x-visible"
    data-testid="custom-slide-layout-picker"
  >
    {templates.map((t) => {
      const isActive = t.id === activeId;

      return (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect(t.id)}
          aria-current={isActive ? "true" : undefined}
          className={cn(
            "shrink-0 rounded border cursor-pointer text-left transition-colors w-32 desktop:w-full",
            isActive
              ? "border-primary ring-1 ring-primary"
              : "border-stroke hover:border-primary hover:bg-primary/10",
          )}
        >
          <div className="pointer-events-none w-full aspect-video overflow-hidden rounded-t bg-black">
            <LayoutRenderer doc={t.doc} data={{}} />
          </div>
          <span className="block px-2 py-1 text-2xs font-medium">{t.name}</span>
        </button>
      );
    })}
  </div>
);
