import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { PluginAPI } from "../Slide/types";
import { Button } from "../components/ui/button";
import "./PluginScaffold.css";
import { VideoVolumeBar } from "./VideoVolumeBar";

type PluginScaffoldPropTypes = {
  title: string;
  toolbar?: React.ReactElement;
  postToolbar?: React.ReactElement;
  body?: React.ReactElement;
  pluginAPI?: PluginAPI | null;
};

/**
 * - full: toolbar shown inline as-is
 * - compact: toolbar inline, buttons with icons hide their label
 * - menu: toolbar collapsed behind a burger button
 */
type ToolbarMode = "full" | "compact" | "menu";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const useToolbarMode = (hasToolbar: boolean) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const postToolbarRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<ToolbarMode>("full");
  const modeRef = useRef(mode);
  modeRef.current = mode;
  // Natural toolbar width in each inline mode, measured whenever that mode is active
  const widthsRef = useRef<Partial<Record<ToolbarMode, number>>>({});

  useIsomorphicLayoutEffect(() => {
    const row = rowRef.current;
    if (!hasToolbar || !row) return;

    const gapOf = (el: HTMLElement | null) =>
      el ? parseFloat(getComputedStyle(el).columnGap) || 0 : 0;

    const measure = () => {
      const title = titleRef.current;
      const available =
        row.clientWidth - (title?.offsetWidth ?? 0) - gapOf(row);

      const current = modeRef.current;
      if (current !== "menu") {
        const toolbarWidth =
          toolbarRef.current?.getBoundingClientRect().width ?? 0;
        const postWidth =
          postToolbarRef.current?.getBoundingClientRect().width ?? 0;
        widthsRef.current[current] =
          toolbarWidth +
          postWidth +
          (toolbarWidth && postWidth ? gapOf(contentRef.current) : 0);
      }

      const fits = (m: ToolbarMode) => {
        const width = widthsRef.current[m];
        // Unknown width: try it so it gets measured
        return width === undefined || width <= available + 0.5;
      };
      const next: ToolbarMode = fits("full")
        ? "full"
        : fits("compact")
          ? "compact"
          : "menu";

      if (next !== current) {
        modeRef.current = next;
        setMode(next);
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    if (toolbarRef.current) observer.observe(toolbarRef.current);
    if (postToolbarRef.current) observer.observe(postToolbarRef.current);
    return () => observer.disconnect();
  }, [hasToolbar]);

  return {
    mode,
    rowRef,
    titleRef,
    contentRef,
    toolbarRef,
    postToolbarRef,
  };
};

export const PluginScaffold = ({
  title,
  toolbar,
  postToolbar,
  body,
  pluginAPI,
}: PluginScaffoldPropTypes) => {
  const hasToolbar = !!toolbar || !!postToolbar;
  const { mode, rowRef, titleRef, contentRef, toolbarRef, postToolbarRef } =
    useToolbarMode(hasToolbar);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (mode !== "menu") setIsMenuOpen(false);
  }, [mode]);

  const isMenu = mode === "menu";

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 bg-gray-900">
        <div
          ref={rowRef}
          className={cn(
            "stack-row gap-5",
            isMenu ? "flex-wrap gap-y-3" : "flex-nowrap",
          )}
        >
          <div ref={titleRef} className="stack-row shrink-0 max-w-full">
            <p className="font-bold text-white truncate">{title}</p>
          </div>
          {isMenu && (
            <Button
              size="xs"
              variant="pill"
              className="ml-auto"
              onClick={() => setIsMenuOpen((x) => !x)}
              aria-expanded={isMenuOpen}
              aria-label={isMenuOpen ? "Hide toolbar" : "Show toolbar"}
            >
              {isMenuOpen ? <X /> : <Menu />}
            </Button>
          )}
          {hasToolbar && (
            <div
              className={cn(
                "flex-1 min-w-0",
                isMenu && "basis-full",
                isMenu && !isMenuOpen && "hidden",
                mode === "compact" && "ui--plugin-scaffold__compact",
              )}
            >
              <div
                ref={contentRef}
                className={cn(
                  "stack-row justify-between gap-2",
                  isMenu ? "flex-wrap" : "flex-nowrap",
                )}
              >
                <div
                  ref={toolbarRef}
                  className={cn(
                    "stack-row gap-2",
                    isMenu ? "flex-wrap" : "shrink-0",
                  )}
                >
                  {toolbar}
                </div>
                <div
                  ref={postToolbarRef}
                  className={cn("stack-row", isMenu ? "flex-wrap" : "shrink-0")}
                >
                  {postToolbar}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex w-full flex-1 min-h-0">
        {pluginAPI && <VideoVolumeBar pluginAPI={pluginAPI} />}
        {body}
      </div>
    </div>
  );
};
