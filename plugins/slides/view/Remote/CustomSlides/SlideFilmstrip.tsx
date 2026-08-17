import { LayoutRenderer } from "@repo/layout/react";
import { Button, PopConfirm, cn } from "@repo/ui";
import { FaPlus, FaRegClone, FaTrash } from "react-icons/fa6";
import { VscArrowDown, VscArrowUp } from "react-icons/vsc";

import { DeckSlide } from "./useCustomSlides";

const EMPTY_DATA = {};

export type SlideFilmstripProps = {
  slides: DeckSlide[];
  selectedSlideIndex: number | null;
  onSelect: (slideIndex: number) => void;
  onAdd: () => void;
  onDuplicate: (slideIndex: number) => void;
  onDelete: (slideIndex: number) => void;
  onMove: (slideIndex: number, direction: "up" | "down") => void;
};

export const SlideFilmstrip = ({
  slides,
  selectedSlideIndex,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onMove,
}: SlideFilmstripProps) => (
  <div
    className="flex gap-2 p-2 flex-row overflow-x-auto desktop:flex-col desktop:overflow-x-visible"
    data-testid="custom-slide-filmstrip"
  >
    {slides.map((slide, position) => {
      const isSelected = slide.slideIndex === selectedSlideIndex;

      return (
        <div
          key={slide.slideId}
          className={cn(
            "shrink-0 rounded border transition-colors w-32 desktop:w-full",
            isSelected
              ? "border-primary ring-1 ring-primary"
              : "border-stroke hover:border-primary",
          )}
        >
          <button
            type="button"
            onClick={() => onSelect(slide.slideIndex)}
            aria-current={isSelected ? "true" : undefined}
            className="block w-full cursor-pointer text-left"
          >
            <div className="pointer-events-none w-full aspect-video overflow-hidden rounded-t bg-black">
              <LayoutRenderer doc={slide.doc} data={EMPTY_DATA} />
            </div>
          </button>

          <div className="flex items-center justify-between gap-0.5 border-t border-stroke px-1 py-0.5">
            <span className="text-2xs font-medium text-secondary pl-1 shrink-0">
              {position + 1}
            </span>
            <div className="flex items-center">
              <Button
                type="button"
                size="xs"
                variant="ghost"
                title="Move earlier"
                disabled={position === 0}
                onClick={() => onMove(slide.slideIndex, "up")}
              >
                <VscArrowUp />
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                title="Move later"
                disabled={position === slides.length - 1}
                onClick={() => onMove(slide.slideIndex, "down")}
              >
                <VscArrowDown />
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                title="Duplicate slide"
                onClick={() => onDuplicate(slide.slideIndex)}
              >
                <FaRegClone />
              </Button>
              <PopConfirm
                title="Delete this slide?"
                description={
                  slides.length === 1
                    ? "This is the last slide, so the whole deck will be removed."
                    : undefined
                }
                okText="Delete"
                onConfirm={() => onDelete(slide.slideIndex)}
              >
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  title="Delete slide"
                >
                  <FaTrash />
                </Button>
              </PopConfirm>
            </div>
          </div>
        </div>
      );
    })}

    <button
      type="button"
      onClick={onAdd}
      className="shrink-0 flex flex-col items-center justify-center gap-1 rounded border-2 border-dashed border-tertiary text-tertiary transition-colors hover:border-secondary hover:text-secondary hover:bg-black/5 cursor-pointer w-32 desktop:w-full aspect-video"
    >
      <FaPlus className="size-4" />
      <span className="text-2xs font-medium">Add slide</span>
    </button>
  </div>
);
