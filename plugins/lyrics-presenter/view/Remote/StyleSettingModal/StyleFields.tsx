import { extractMediaName } from "@repo/lib";
import {
  Button,
  CheckboxControl,
  ColorPickerControl,
  FormLabel,
  MediaPreview,
  MediaPreviewData,
  NumberInputControl,
  OptionControl,
  SelectControl,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ToggleControl,
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui";
import { InternalVideo } from "@repo/video";
import { useCallback, useMemo, useRef } from "react";
import { Control, UseFormSetValue } from "react-hook-form";
import { FaBold, FaItalic, FaLink } from "react-icons/fa6";
import { MdOutlineSettingsBackupRestore } from "react-icons/md";
import {
  TbLayoutAlignBottom,
  TbLayoutAlignMiddle,
  TbLayoutAlignTop,
} from "react-icons/tb";
import { VscAdd, VscTrash } from "react-icons/vsc";

import {
  SlideStyle,
  backgroundTypes,
  verticalAlignments,
} from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";

export type StyleFieldsProps = {
  control: Control<SlideStyle>;
  data: SlideStyle;
  setValue: UseFormSetValue<SlideStyle>;
  isOverrideMode?: boolean;
  currentOverride?: SlideStyle | null;
  onResetFields?: (fieldNames: (keyof SlideStyle)[]) => void;
};

const OverrideIndicator = ({
  isOverridden,
  onReset,
  label,
}: {
  isOverridden: boolean;
  onReset: () => void;
  label?: string;
}) => {
  if (!isOverridden) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-5 w-5 text-muted-foreground hover:text-destructive"
      onClick={onReset}
      title={`Reset ${label ?? "this field"} to use global style`}
    >
      <MdOutlineSettingsBackupRestore className="h-3 w-3" />
    </Button>
  );
};

const OverrideFieldWrapper = ({
  isOverridden,
  children,
}: {
  isOverridden: boolean;
  children: React.ReactNode;
}) => {
  return (
    <div
      className={isOverridden ? "border-l-2 border-orange-500 pl-2" : undefined}
    >
      {children}
    </div>
  );
};

export const StyleFields = ({
  control,
  data,
  setValue,
  isOverrideMode = false,
  currentOverride,
  onResetFields,
}: StyleFieldsProps) => {
  const isFieldOverridden = (fieldName: keyof SlideStyle): boolean => {
    if (!isOverrideMode || !currentOverride) return false;
    return currentOverride[fieldName] !== undefined;
  };

  const handleResetFields = (fieldNames: (keyof SlideStyle)[]) => {
    onResetFields?.(fieldNames);
  };

  return (
    <Tabs defaultValue="text" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="text">Text</TabsTrigger>
        <TabsTrigger value="placement">Placement</TabsTrigger>
        <TabsTrigger value="background">Background</TabsTrigger>
      </TabsList>

      {/* Text Tab */}
      <TabsContent value="text" className="flex flex-col items-start gap-4">
        <OverrideFieldWrapper isOverridden={isFieldOverridden("autoSize")}>
          <div className="w-full">
            <div className="flex items-center gap-2 mb-1">
              <FormLabel className="mb-0 shrink-0">Font Type</FormLabel>
              {isOverrideMode && (
                <OverrideIndicator
                  isOverridden={isFieldOverridden("autoSize")}
                  onReset={() => handleResetFields(["autoSize"])}
                  label="Font Type"
                />
              )}
            </div>
            <OptionControl
              control={control}
              name="autoSize"
              label=""
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
        </OverrideFieldWrapper>

        {!data.autoSize && (
          <OverrideFieldWrapper isOverridden={isFieldOverridden("fontSize")}>
            <div className="flex flex-col items-start gap-2">
              <div className="flex items-center gap-2">
                <FormLabel className="mb-0 shrink-0">Font Size</FormLabel>
                {isOverrideMode && (
                  <OverrideIndicator
                    isOverridden={isFieldOverridden("fontSize")}
                    onReset={() => handleResetFields(["fontSize"])}
                    label="Font Size"
                  />
                )}
              </div>
              <NumberInputControl
                control={control}
                name="fontSize"
                unit="pt"
                min={0}
                step={0.5}
                className="max-w-40"
              />
            </div>
          </OverrideFieldWrapper>
        )}

        <OverrideFieldWrapper isOverridden={isFieldOverridden("lineHeight")}>
          <div className="flex flex-col items-start gap-2">
            <div className="flex items-center gap-2">
              <FormLabel className="mb-0 shrink-0">Line Height</FormLabel>
              {isOverrideMode && (
                <OverrideIndicator
                  isOverridden={isFieldOverridden("lineHeight")}
                  onReset={() => handleResetFields(["lineHeight"])}
                  label="Line Height"
                />
              )}
            </div>
            <NumberInputControl
              control={control}
              name="lineHeight"
              min={0}
              step={0.1}
              className="max-w-40"
            />
          </div>
        </OverrideFieldWrapper>

        <OverrideFieldWrapper
          isOverridden={
            isFieldOverridden("fontWeight") || isFieldOverridden("fontStyle")
          }
        >
          <div className="flex flex-col items-start gap-2">
            <div className="flex items-center gap-2">
              <FormLabel className="mb-0 shrink-0">Style</FormLabel>
              {isOverrideMode && (
                <OverrideIndicator
                  isOverridden={
                    isFieldOverridden("fontWeight") ||
                    isFieldOverridden("fontStyle")
                  }
                  onReset={() => handleResetFields(["fontWeight", "fontStyle"])}
                  label="Style"
                />
              )}
            </div>
            <ToggleGroup
              type="multiple"
              value={
                [
                  data.fontWeight === "600" && "bold",
                  data.fontStyle === "italic" && "italic",
                ].filter((x) => x) as string[]
              }
              onValueChange={(val) => {
                setValue("fontWeight", val.includes("bold") ? "600" : "400");
                setValue(
                  "fontStyle",
                  val.includes("italic") ? "italic" : "normal",
                );
              }}
            >
              <ToggleGroupItem value="bold" aria-label="Toggle bold">
                <FaBold />
              </ToggleGroupItem>
              <ToggleGroupItem value="italic" aria-label="Toggle italic">
                <FaItalic />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </OverrideFieldWrapper>

        <OverrideFieldWrapper isOverridden={isFieldOverridden("textColor")}>
          <div className="flex flex-col items-start gap-2">
            <div className="flex items-center gap-2">
              <FormLabel className="mb-0 shrink-0">Text Color</FormLabel>
              {isOverrideMode && (
                <OverrideIndicator
                  isOverridden={isFieldOverridden("textColor")}
                  onReset={() => handleResetFields(["textColor"])}
                  label="Text Color"
                />
              )}
            </div>
            <ColorPickerControl
              control={control}
              name="textColor"
              label=""
              alpha
            />
          </div>
        </OverrideFieldWrapper>

        <OverrideFieldWrapper
          isOverridden={
            isFieldOverridden("textShadow") || isFieldOverridden("textOutline")
          }
        >
          <div className="flex flex-col items-start gap-2">
            <div className="flex items-center gap-2">
              <FormLabel className="mb-0 shrink-0">Text Effects</FormLabel>
              {isOverrideMode && (
                <OverrideIndicator
                  isOverridden={
                    isFieldOverridden("textShadow") ||
                    isFieldOverridden("textOutline")
                  }
                  onReset={() =>
                    handleResetFields(["textShadow", "textOutline"])
                  }
                  label="Text Effects"
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Improve text visibility over video backgrounds
            </p>
            <div className="flex flex-col gap-2">
              <CheckboxControl
                control={control}
                name="textShadow"
                label="Text Shadow"
              />
              <CheckboxControl
                control={control}
                name="textOutline"
                label="Text Outline"
              />
            </div>
          </div>
        </OverrideFieldWrapper>
      </TabsContent>

      {/* Placement Tab */}
      <TabsContent
        value="placement"
        className="flex flex-col items-start gap-4"
      >
        <OverrideFieldWrapper isOverridden={isFieldOverridden("verticalAlign")}>
          <div className="flex flex-col items-start gap-2">
            <div className="flex items-center gap-2">
              <FormLabel className="mb-0 shrink-0">Vertical Align</FormLabel>
              {isOverrideMode && (
                <OverrideIndicator
                  isOverridden={isFieldOverridden("verticalAlign")}
                  onReset={() => handleResetFields(["verticalAlign"])}
                  label="Vertical Align"
                />
              )}
            </div>
            <ToggleGroup
              type="single"
              value={data.verticalAlign}
              onValueChange={(val) => {
                if (val) {
                  setValue(
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
        </OverrideFieldWrapper>
        <OverrideFieldWrapper
          isOverridden={
            isFieldOverridden("paddingIsLinked") ||
            isFieldOverridden("padding") ||
            isFieldOverridden("leftPadding") ||
            isFieldOverridden("topPadding") ||
            isFieldOverridden("rightPadding") ||
            isFieldOverridden("bottomPadding")
          }
        >
          <div className="flex flex-col items-start gap-2">
            <div className="flex items-center gap-2">
              <FormLabel className="mb-0 shrink-0">Padding</FormLabel>
              {isOverrideMode && (
                <OverrideIndicator
                  isOverridden={
                    isFieldOverridden("paddingIsLinked") ||
                    isFieldOverridden("padding") ||
                    isFieldOverridden("leftPadding") ||
                    isFieldOverridden("topPadding") ||
                    isFieldOverridden("rightPadding") ||
                    isFieldOverridden("bottomPadding")
                  }
                  onReset={() =>
                    handleResetFields([
                      "paddingIsLinked",
                      "padding",
                      "leftPadding",
                      "topPadding",
                      "rightPadding",
                      "bottomPadding",
                    ])
                  }
                  label="Padding"
                />
              )}
            </div>
            <div className="[&>*]:flex">
              <ToggleControl
                control={control}
                name="paddingIsLinked"
                label="Link"
                className="flex-row"
              >
                <FaLink />
              </ToggleControl>
            </div>

            {data.paddingIsLinked ? (
              <NumberInputControl
                control={control}
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
                    key={name}
                    control={control}
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
        </OverrideFieldWrapper>
      </TabsContent>

      {/* Background Tab */}
      <TabsContent
        value="background"
        className="flex flex-col items-start gap-4"
      >
        <OverrideFieldWrapper
          isOverridden={isFieldOverridden("backgroundType")}
        >
          <div className="flex flex-col items-start gap-2">
            <div className="flex items-center gap-2">
              <FormLabel className="mb-0 shrink-0">Background Type</FormLabel>
              {isOverrideMode && (
                <OverrideIndicator
                  isOverridden={isFieldOverridden("backgroundType")}
                  onReset={() => handleResetFields(["backgroundType"])}
                  label="Background Type"
                />
              )}
            </div>
            <SelectControl
              control={control}
              name="backgroundType"
              label=""
              options={backgroundTypes.map((type) => ({
                label: type === "solid" ? "Solid Color" : "Video",
                value: type,
              }))}
              isSearchable={false}
            />
          </div>
        </OverrideFieldWrapper>

        {data.backgroundType === "solid" && (
          <OverrideFieldWrapper
            isOverridden={isFieldOverridden("backgroundColor")}
          >
            <div className="flex flex-col items-start gap-2">
              <div className="flex items-center gap-2">
                <FormLabel className="mb-0 shrink-0">
                  Background Color
                </FormLabel>
                {isOverrideMode && (
                  <OverrideIndicator
                    isOverridden={isFieldOverridden("backgroundColor")}
                    onReset={() => handleResetFields(["backgroundColor"])}
                    label="Background Color"
                  />
                )}
              </div>
              <ColorPickerControl
                control={control}
                name="backgroundColor"
                label=""
                alpha
              />
            </div>
          </OverrideFieldWrapper>
        )}

        {data.backgroundType === "video" && (
          <VideoBackgroundSelector
            setValue={setValue}
            currentVideoMediaId={data.backgroundVideoMediaId ?? null}
            isOverrideMode={isOverrideMode}
            isFieldOverridden={isFieldOverridden("backgroundVideoMediaId")}
            onResetField={() => handleResetFields(["backgroundVideoMediaId"])}
          />
        )}
      </TabsContent>
    </Tabs>
  );
};

export const StylePreviewControls = ({
  control,
}: {
  control: Control<SlideStyle>;
}) => {
  return (
    <div className="flex justify-center [&>*]:w-auto">
      <CheckboxControl
        control={control}
        name="debugPadding"
        label="Show Padding"
      />
    </div>
  );
};

type VideoBackgroundSelectorProps = {
  setValue: UseFormSetValue<SlideStyle>;
  currentVideoMediaId: string | null;
  isOverrideMode: boolean;
  isFieldOverridden: boolean;
  onResetField: () => void;
};

const VideoBackgroundSelector = ({
  setValue,
  currentVideoMediaId,
  isOverrideMode,
  isFieldOverridden,
  onResetField,
}: VideoBackgroundSelectorProps) => {
  const pluginApi = usePluginAPI();
  const videoBackgrounds = pluginApi.scene.useData(
    (x) => x.pluginData.videoBackgrounds,
  );
  const globalStyle = pluginApi.scene.useData((x) => x.pluginData.style);
  const songs = pluginApi.scene.useData((x) => x.pluginData.songs);
  const mutableSceneData = pluginApi.scene.useValtioData();

  const currentVideo = currentVideoMediaId
    ? (videoBackgrounds.find((v) => v.id === currentVideoMediaId) ?? null)
    : null;

  const divRef = useRef<HTMLDivElement>(null);

  const handleImportVideo = useCallback(async () => {
    const result = await pluginApi.mediaPicker.show({
      type: "video",
      title: "Select Background Video",
      portalContainer: divRef.current,
    });

    if (result?.internalVideo) {
      const existingVideo = mutableSceneData.pluginData.videoBackgrounds.find(
        (v) => v.url === result.internalVideo!.url,
      );

      if (existingVideo) {
        setValue("backgroundVideoMediaId", existingVideo.id);
      } else {
        mutableSceneData.pluginData.videoBackgrounds.push(result.internalVideo);
        setValue("backgroundVideoMediaId", result.internalVideo.id);
      }
    }
  }, [
    pluginApi.mediaPicker,
    mutableSceneData.pluginData.videoBackgrounds,
    setValue,
  ]);

  const handleRemoveVideo = useCallback(() => {
    if (!currentVideoMediaId) return;

    setValue("backgroundVideoMediaId", null);

    const isUsedByGlobalStyle =
      globalStyle?.backgroundVideoMediaId === currentVideoMediaId;

    const isUsedBySongOverride = songs.some(
      (song) =>
        song.styleOverride?.backgroundVideoMediaId === currentVideoMediaId,
    );

    // Only remove from videoBackgrounds if no one else is using it
    if (!isUsedByGlobalStyle && !isUsedBySongOverride) {
      const index = mutableSceneData.pluginData.videoBackgrounds.findIndex(
        (v) => v.id === currentVideoMediaId,
      );
      if (index !== -1) {
        mutableSceneData.pluginData.videoBackgrounds.splice(index, 1);
      }
    }
  }, [
    currentVideoMediaId,
    mutableSceneData.pluginData.videoBackgrounds,
    setValue,
    globalStyle?.backgroundVideoMediaId,
    songs,
  ]);

  return (
    <OverrideFieldWrapper isOverridden={isFieldOverridden}>
      <div ref={divRef} className="flex flex-col items-start gap-2">
        <div className="flex items-center gap-2">
          <FormLabel className="mb-0 shrink-0">Background Video</FormLabel>
          {isOverrideMode && (
            <OverrideIndicator
              isOverridden={isFieldOverridden}
              onReset={onResetField}
              label="Background Video"
            />
          )}
        </div>

        {currentVideo ? (
          <VideoBackgroundCard
            video={currentVideo}
            onRemove={handleRemoveVideo}
            onChangeVideo={handleImportVideo}
          />
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleImportVideo}
          >
            <VscAdd className="mr-1" />
            Import Video
          </Button>
        )}
      </div>
    </OverrideFieldWrapper>
  );
};

type VideoBackgroundCardProps = {
  video: InternalVideo;
  onRemove: () => void;
  onChangeVideo: () => void;
};

const VideoBackgroundCard = ({
  video,
  onRemove,
  onChangeVideo,
}: VideoBackgroundCardProps) => {
  const mediaPreviewData: MediaPreviewData | null = useMemo(() => {
    const urlParts = video.url.split("/");
    const mediaName = urlParts[urlParts.length - 1] ?? "";

    return {
      mediaName,
      fileExtension: extractMediaName(mediaName).extension,
      videoMetadata: {
        thumbnailMediaId: video.thumbnailMediaName
          ? extractMediaName(video.thumbnailMediaName).uuid
          : null,
        hlsMediaId: video.hlsMediaName
          ? extractMediaName(video.hlsMediaName).uuid
          : null,
      },
    };
  }, [video]);

  return (
    <div className="border rounded-lg overflow-hidden max-w-[200px]">
      <div className="aspect-video bg-gray-100">
        <MediaPreview
          media={mediaPreviewData}
          showProcessingOverlay={false}
          className="w-full h-full"
        />
      </div>

      <div className="p-2">
        <span
          className="text-xs truncate block mb-2"
          title={video.metadata.title ?? "Untitled"}
        >
          {video.metadata.title ?? "Untitled"}
        </span>
        <div className="flex gap-1">
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={onChangeVideo}
          >
            Change
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={onRemove}
            title="Remove video"
          >
            <VscTrash className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};
