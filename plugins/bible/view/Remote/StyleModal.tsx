import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Slide,
  SlideGrid,
  useOverlayToggle,
} from "@repo/ui";
import { useEffect, useMemo, useState } from "react";

import { defaultBibleStyle, getBibleStyle } from "../../src/style/style";
import {
  BiblePassage,
  BibleSlideStyle,
  textAlignments,
} from "../../src/types";
import VerseView from "../Renderer/VerseView";
import { usePluginAPI } from "../pluginApi";

const PREVIEW_PASSAGE: BiblePassage = {
  id: "preview",
  reference: "John 3:16",
  translationId: "web",
  translationName: "World English Bible",
  verses: [
    {
      bookId: "JHN",
      bookName: "John",
      chapter: 3,
      verse: 16,
      text: "For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life.",
    },
  ],
};

const StyleModal = () => {
  const { isOpen, onToggle } = useOverlayToggle();
  const pluginApi = usePluginAPI();
  const mutableSceneData = pluginApi.scene.useValtioData();
  const savedStyle = pluginApi.scene.useData((x) => x.pluginData.style);

  const [style, setStyle] = useState<BibleSlideStyle>(() =>
    getBibleStyle(savedStyle),
  );

  useEffect(() => {
    setStyle(getBibleStyle(savedStyle));
  }, [savedStyle]);

  const mergedStyle = useMemo(() => getBibleStyle(style), [style]);

  const update = <K extends keyof BibleSlideStyle>(
    key: K,
    value: BibleSlideStyle[K],
  ) => setStyle((prev) => ({ ...prev, [key]: value }));

  const onSave = () => {
    mutableSceneData.pluginData.style = { ...style };
    onToggle?.();
  };

  const onReset = () => setStyle({ ...defaultBibleStyle });

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent size="2xl">
        <DialogHeader className="px-3 md:px-6">
          <DialogTitle>Slide Style</DialogTitle>
        </DialogHeader>
        <DialogBody className="px-3 md:px-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex gap-4">
                <label className="flex flex-col gap-1 flex-1">
                  <span className="text-sm font-medium">Text color</span>
                  <input
                    type="color"
                    value={mergedStyle.textColor}
                    onChange={(e) => update("textColor", e.target.value)}
                    className="h-9 w-full"
                  />
                </label>
                <label className="flex flex-col gap-1 flex-1">
                  <span className="text-sm font-medium">Background</span>
                  <input
                    type="color"
                    value={mergedStyle.backgroundColor}
                    onChange={(e) => update("backgroundColor", e.target.value)}
                    className="h-9 w-full"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  Font size ({mergedStyle.fontSize.toFixed(1)})
                </span>
                <input
                  type="range"
                  min={1}
                  max={6}
                  step={0.1}
                  value={mergedStyle.fontSize}
                  onChange={(e) =>
                    update("fontSize", parseFloat(e.target.value))
                  }
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Font weight</span>
                <select
                  className="h-9 border rounded px-2 bg-transparent"
                  value={mergedStyle.fontWeight}
                  onChange={(e) =>
                    update("fontWeight", parseInt(e.target.value, 10))
                  }
                >
                  <option value={400}>Normal</option>
                  <option value={600}>Semi-bold</option>
                  <option value={700}>Bold</option>
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Font family</span>
                <Input
                  value={mergedStyle.fontFamily}
                  onChange={(e) => update("fontFamily", e.target.value)}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Text align</span>
                <select
                  className="h-9 border rounded px-2 bg-transparent"
                  value={mergedStyle.textAlign}
                  onChange={(e) =>
                    update(
                      "textAlign",
                      e.target.value as BibleSlideStyle["textAlign"],
                    )
                  }
                >
                  {textAlignments.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={mergedStyle.showReference}
                  onChange={(e) => update("showReference", e.target.checked)}
                />
                <span className="text-sm">Show reference</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={mergedStyle.showVerseNumbers}
                  onChange={(e) => update("showVerseNumbers", e.target.checked)}
                />
                <span className="text-sm">Show verse numbers</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={mergedStyle.textShadow}
                  onChange={(e) => update("textShadow", e.target.checked)}
                />
                <span className="text-sm">Text shadow</span>
              </label>
            </div>

            <div className="flex flex-col basis-[220px] gap-2">
              <h3 className="text-lg font-medium text-center">Preview</h3>
              <SlideGrid pluginAPI={pluginApi} forceWidth={220}>
                <Slide pluginAPI={pluginApi}>
                  <VerseView
                    passage={PREVIEW_PASSAGE}
                    slideIndex={0}
                    style={mergedStyle}
                  />
                </Slide>
              </SlideGrid>
            </div>
          </div>
        </DialogBody>
        <DialogFooter className="px-3 md:px-6 pb-3">
          <div className="stack-row justify-end w-full">
            <Button variant="outline" onClick={onReset}>
              Reset
            </Button>
            <Button variant="success" onClick={onSave}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StyleModal;
