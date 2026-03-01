import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  CheckboxControl,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormLabel,
  NumberInputControl,
  OptionControl,
  SelectControl,
  SlideGrid,
  ToggleControl,
  ToggleGroup,
  ToggleGroupItem,
  useOverlayToggle,
} from "@repo/ui";
import { useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { FaBold, FaItalic, FaLink } from "react-icons/fa6";
import {
  TbLayoutAlignBottom,
  TbLayoutAlignMiddle,
  TbLayoutAlignTop,
} from "react-icons/tb";

import { getSlideStyle } from "../../../src/slideStyle";
import {
  SlideStyle,
  slideStyleValidator,
  verticalAlignments,
} from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { MobilePreview } from "../RemoteEditSongModal/MobilePreview";
import { SongViewSlides } from "../SongViewSlides";

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
                <div className="flex-1 flex flex-col items-start gap-4">
                  <h3 className="text-xl font-bold">General</h3>
                  <SelectControl
                    control={form.control}
                    name="isDarkMode"
                    label="Theme"
                    options={[
                      { label: "Dark", value: true },
                      { label: "Light", value: false },
                    ]}
                    isSearchable={false}
                  />

                  <h3 className="text-xl font-bold mt-5">Text style</h3>
                  <div className="w-full">
                    <OptionControl
                      control={form.control}
                      name="autoSize"
                      label="Font Type"
                      options={[
                        {
                          title: "Auto fit",
                          description: "Fit your lyrics in the available space",
                          value: true,
                        },
                        {
                          title: "Manual",
                          description: "Manually set the size of your fonts",
                          value: false,
                        },
                      ]}
                    />
                  </div>

                  {!data.autoSize && (
                    <NumberInputControl
                      control={form.control}
                      name="fontSize"
                      label="Font Size"
                      unit="pt"
                      min={0}
                      step={0.5}
                      className="max-w-40"
                    />
                  )}

                  <NumberInputControl
                    control={form.control}
                    name="lineHeight"
                    label="Line Height"
                    min={0}
                    step={0.1}
                    className="max-w-40"
                  />

                  <div className="flex flex-row items-center gap-2">
                    <FormLabel className="mb-0 shrink-0">Style: </FormLabel>
                    <ToggleGroup
                      type="multiple"
                      value={
                        [
                          data.fontWeight === "600" && "bold",
                          data.fontStyle === "italic" && "italic",
                        ].filter((x) => x) as string[]
                      }
                      onValueChange={(val) => {
                        form.setValue(
                          "fontWeight",
                          val.includes("bold") ? "600" : "400",
                        );
                        form.setValue(
                          "fontStyle",
                          val.includes("italic") ? "italic" : "normal",
                        );
                      }}
                    >
                      <ToggleGroupItem value="bold" aria-label="Toggle bold">
                        <FaBold />
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="italic"
                        aria-label="Toggle italic"
                      >
                        <FaItalic />
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  <h3 className="text-xl font-bold mt-5">Placement</h3>
                  <div className="flex flex-row items-center gap-2">
                    <FormLabel className="mb-0 shrink-0">
                      Vertical Align:{" "}
                    </FormLabel>
                    <ToggleGroup
                      type="single"
                      value={data.verticalAlign}
                      onValueChange={(val) => {
                        if (val) {
                          form.setValue(
                            "verticalAlign",
                            val as (typeof verticalAlignments)[number],
                          );
                        }
                      }}
                    >
                      <ToggleGroupItem value="top" aria-label="Align top">
                        <TbLayoutAlignTop />
                      </ToggleGroupItem>
                      <ToggleGroupItem value="center" aria-label="Align center">
                        <TbLayoutAlignMiddle />
                      </ToggleGroupItem>
                      <ToggleGroupItem value="bottom" aria-label="Align bottom">
                        <TbLayoutAlignBottom />
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  <div className="[&>*]:flex">
                    <ToggleControl
                      control={form.control}
                      name="paddingIsLinked"
                      label="Padding"
                      className="flex-row"
                    >
                      <FaLink />
                    </ToggleControl>
                  </div>

                  {data.paddingIsLinked ? (
                    <NumberInputControl
                      control={form.control}
                      name="padding"
                      unit="%"
                      min={0}
                      max={100}
                      step={0.5}
                      className="max-w-40"
                    />
                  ) : (
                    <div className="flex flex-col gap-4 sm:flex-row sm:gap-2">
                      {(
                        [
                          { name: "leftPadding", label: "Left" },
                          { name: "topPadding", label: "Top" },
                          { name: "rightPadding", label: "Right" },
                          { name: "bottomPadding", label: "Bottom" },
                        ] as const
                      ).map(({ name, label }) => (
                        <NumberInputControl
                          control={form.control}
                          name={name}
                          label={label}
                          unit="%"
                          min={0}
                          max={100}
                          step={0.5}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div className="hidden md:flex flex-col basis-[200px] gap-2">
                  <h3 className="text-lg font-medium text-center">Preview</h3>

                  <SlideGrid forceWidth={200}>{preview}</SlideGrid>

                  <div className="flex justify-center [&>*]:w-auto">
                    <CheckboxControl
                      control={form.control}
                      name="debugPadding"
                      label="Show Padding"
                    />
                  </div>
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
