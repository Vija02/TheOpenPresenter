import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  SlideGrid,
  useOverlayToggle,
} from "@repo/ui";
import { useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

import { getSlideStyle } from "../../../src/slideStyle";
import { SlideStyle, slideStyleValidator } from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { MobilePreview } from "../RemoteEditSongModal/MobilePreview";
import { SongViewSlides } from "../SongViewSlides";
import { StyleFields, StylePreviewControls } from "./StyleFields";

const StyleSettingModal = () => {
  const { isOpen, onToggle, resetData } = useOverlayToggle();

  const pluginApi = usePluginAPI();
  const mutablePluginInfo = pluginApi.scene.useValtioData();

  const style = pluginApi.scene.useData((x) => x.pluginData.style);

  const slideStyle = useMemo(() => getSlideStyle(style), [style]);

  const form = useForm<SlideStyle>({
    resolver: zodResolver(slideStyleValidator) as any,
    values: { ...slideStyle, debugPadding: true },
  });

  const data = form.watch();

  useEffect(() => {
    if (style === undefined) {
      mutablePluginInfo.pluginData.style = {};
    }
  }, [mutablePluginInfo.pluginData, style]);

  const handleSubmit = useCallback(
    (rawData: SlideStyle) => {
      const data = slideStyleValidator.parse(rawData);
      mutablePluginInfo.pluginData.style = { ...data, debugPadding: false };
      resetData?.();
      onToggle?.();
      return Promise.resolve();
    },
    [mutablePluginInfo.pluginData, onToggle, resetData],
  );

  const preview = useMemo(
    () => (
      <SongViewSlides
        song={{
          id: "",
          _imported: false,
          title: "",
          setting: { displayType: "sections" },
          content:
            "[Song 1]\nThen sings my soul\nMy Saviour God to Thee\nHow great Thou art\nHow great Thou art\n\n[Song 2]\nIn Christ alone my hope is found,\nHe is my light, my strength, my song;\n\n[Demo]\nLorem ipsum dolor sit amet\nConsectetur adipiscing elit\nIn fringilla quam non\nmauris ornare condimentum\nSuspendisse in orci nunc",
        }}
        slideStyle={data}
        isPreview
      />
    ),
    [data],
  );

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <Form {...form}>
        <DialogContent size="3xl" asChild>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader className="px-3 md:px-6">
              <DialogTitle>Slide Styles</DialogTitle>
            </DialogHeader>
            <DialogBody className="px-3 md:px-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <StyleFields
                    control={form.control}
                    data={data}
                    setValue={form.setValue}
                  />
                </div>
                <div className="hidden md:flex flex-col basis-[200px] gap-2">
                  <h3 className="text-lg font-medium text-center">Preview</h3>

                  <SlideGrid pluginAPI={pluginApi} forceWidth={200}>
                    {preview}
                  </SlideGrid>

                  <StylePreviewControls control={form.control} />
                </div>
              </div>
            </DialogBody>
            <DialogFooter className="pl-lyrics--preview-shadow pt-0 px-0 pb-3">
              <div className="flex flex-col w-full">
                <MobilePreview preview={preview} />
                <div className="stack-row px-3 md:px-6 pt-3 justify-end">
                  <Button type="submit" variant="success">
                    Save
                  </Button>
                  <Button variant="outline" onClick={onToggle}>
                    Close
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Form>
    </Dialog>
  );
};

export default StyleSettingModal;
