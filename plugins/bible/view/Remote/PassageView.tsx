import { Button, PopConfirm, Slide, SlideGrid } from "@repo/ui";
import React, { useCallback } from "react";
import {
  VscArrowDown,
  VscArrowUp,
  VscFold,
  VscTrash,
  VscUnfold,
} from "react-icons/vsc";

import {
  getPassageSlides,
  mergeWithNextSlide,
  splitSlide,
} from "../../src/helpers/slides";
import { BiblePassage } from "../../src/types";
import VerseView from "../Renderer/VerseView";
import { usePluginAPI } from "../pluginApi";

type PassageViewProps = {
  passage: BiblePassage;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
};

const PassageView = React.memo(
  ({ passage, onMoveUp, onMoveDown }: PassageViewProps) => {
    const pluginApi = usePluginAPI();
    const mutableSceneData = pluginApi.scene.useValtioData();
    const mutableRendererData = pluginApi.renderer.useValtioData();
    const setRenderCurrentScene = pluginApi.renderer.setRenderCurrentScene;
    const style = pluginApi.scene.useData((x) => x.pluginData.style);
    const renderData = pluginApi.renderer.useData((x) => x);

    const handleRemove = useCallback(() => {
      const pluginData = mutableSceneData.pluginData;
      pluginData.passages = pluginData.passages.filter(
        (p) => p.id !== passage.id,
      );
    }, [mutableSceneData.pluginData, passage.id]);

    // Persist a new slide grouping, and keep the live slide in range if this
    // passage is the one currently on screen (merging can drop the last slide)
    const applyGroups = useCallback(
      (sizes: number[]) => {
        const target = mutableSceneData.pluginData.passages.find(
          (p) => p.id === passage.id,
        );
        if (!target) return;
        target.slideGroups = sizes;

        if (
          mutableRendererData.passageId === passage.id &&
          (mutableRendererData.slideIndex ?? 0) > sizes.length - 1
        ) {
          mutableRendererData.slideIndex = sizes.length - 1;
          setRenderCurrentScene();
        }
      },
      [
        mutableSceneData.pluginData,
        mutableRendererData,
        passage.id,
        setRenderCurrentScene,
      ],
    );

    const slides = getPassageSlides(passage);

    return (
      <div className="pb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex flex-col">
            <p className="text-xl mb-0 font-bold">{passage.reference}</p>
            <p className="text-xs text-secondary">{passage.translationName}</p>
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <Button
              size="xs"
              variant="ghost"
              onClick={onMoveUp}
              disabled={!onMoveUp}
              title="Move up"
            >
              <VscArrowUp />
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={onMoveDown}
              disabled={!onMoveDown}
              title="Move down"
            >
              <VscArrowDown />
            </Button>
            <PopConfirm
              title="Are you sure you want to remove this passage?"
              onConfirm={handleRemove}
              okText="Yes"
              cancelText="No"
              key="remove"
            >
              <Button
                size="xs"
                variant="ghost"
                data-testid="bible-remove-passage"
              >
                <VscTrash />
              </Button>
            </PopConfirm>
          </div>
        </div>
        <SlideGrid pluginAPI={pluginApi}>
          {slides.map((slide, i) => {
            const first = passage.verses[slide.start];
            const last = passage.verses[slide.start + slide.count - 1];
            const heading =
              slide.count > 1
                ? `v${first?.verse}-${last?.verse}`
                : `v${first?.verse}`;
            const isActive =
              renderData.passageId === passage.id && renderData.slideIndex === i;

            return (
              <Slide
                key={i}
                pluginAPI={pluginApi}
                heading={heading}
                isActive={isActive}
                headingRight={
                  // Stop clicks here from selecting the slide.
                  <div
                    className="flex items-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {slide.count > 1 && (
                      <Button
                        size="xs"
                        variant="ghost"
                        title="Split into one verse per slide"
                        onClick={() => applyGroups(splitSlide(passage, i))}
                      >
                        <VscUnfold />
                      </Button>
                    )}
                    {i < slides.length - 1 && (
                      <Button
                        size="xs"
                        variant="ghost"
                        title="Merge with next slide"
                        onClick={() =>
                          applyGroups(mergeWithNextSlide(passage, i))
                        }
                      >
                        <VscFold />
                      </Button>
                    )}
                  </div>
                }
                onClick={() => {
                  mutableRendererData.passageId = passage.id;
                  mutableRendererData.slideIndex = i;
                  setRenderCurrentScene();
                }}
              >
                <VerseView passage={passage} slideIndex={i} style={style} />
              </Slide>
            );
          })}
        </SlideGrid>
      </div>
    );
  },
);

export default PassageView;
