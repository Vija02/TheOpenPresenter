import { LayoutRenderer } from "../react/LayoutRenderer";
import { Template } from "../schema/document";
import { FrameData } from "../template/spans";

export type TemplateRailProps = {
  templates: Template[];
  /** Sample bindings, so thumbnails show real content rather than tokens. */
  data?: FrameData;
  activeId?: string | null;
  onSelect: (templateId: string) => void;
  title?: string | null;
  columns?: 1 | 2;
};

export const TemplateRail = ({
  templates,
  data = {},
  activeId = null,
  onSelect,
  title = "Templates",
  columns = 1,
}: TemplateRailProps) => (
  <div className="flex flex-col gap-3">
    {title !== null && (
      <h3 className="text-xs font-semibold uppercase tracking-wide text-secondary">
        {title}
      </h3>
    )}

    <div
      className={`grid gap-3 ${columns === 2 ? "grid-cols-2" : "grid-cols-1"}`}
    >
      {templates.map((t) => {
        const active = t.id === activeId;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className={`text-left rounded border cursor-pointer transition-colors ${
              active
                ? "border-primary ring-1 ring-primary"
                : "border-stroke hover:border-primary hover:bg-primary/10"
            }`}
          >
            <div className="w-full aspect-video overflow-hidden rounded-t bg-black pointer-events-none">
              <LayoutRenderer doc={t.doc} data={data} />
            </div>
            <span className="block px-2 py-1 text-xs font-medium">
              {t.name}
            </span>
          </button>
        );
      })}
    </div>
  </div>
);
