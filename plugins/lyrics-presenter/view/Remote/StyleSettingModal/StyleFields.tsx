import {
  Button,
  CheckboxControl,
  FormLabel,
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
import { Control, UseFormSetValue } from "react-hook-form";
import { FaBold, FaItalic, FaLink } from "react-icons/fa6";
import { MdOutlineSettingsBackupRestore } from "react-icons/md";
import {
  TbLayoutAlignBottom,
  TbLayoutAlignMiddle,
  TbLayoutAlignTop,
} from "react-icons/tb";

import { SlideStyle, verticalAlignments } from "../../../src/types";

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

        <h4 className="text-lg font-semibold mt-4">Text Color</h4>
        <OverrideFieldWrapper isOverridden={isFieldOverridden("isDarkMode")}>
          <div className="flex flex-col items-start gap-2">
            <div className="flex items-center gap-2">
              <FormLabel className="mb-0 shrink-0">Color Mode</FormLabel>
              {isOverrideMode && (
                <OverrideIndicator
                  isOverridden={isFieldOverridden("isDarkMode")}
                  onReset={() => handleResetFields(["isDarkMode"])}
                  label="Color Mode"
                />
              )}
            </div>
            <SelectControl
              control={control}
              name="isDarkMode"
              label=""
              options={[
                {
                  label: "Light text (for dark backgrounds)",
                  value: true,
                },
                {
                  label: "Dark text (for light backgrounds)",
                  value: false,
                },
              ]}
              isSearchable={false}
            />
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
        <OverrideFieldWrapper isOverridden={isFieldOverridden("isDarkMode")}>
          <div className="flex flex-col items-start gap-2">
            <div className="flex items-center gap-2">
              <FormLabel className="mb-0 shrink-0">Background Theme</FormLabel>
              {isOverrideMode && (
                <OverrideIndicator
                  isOverridden={isFieldOverridden("isDarkMode")}
                  onReset={() => handleResetFields(["isDarkMode"])}
                  label="Background Theme"
                />
              )}
            </div>
            <SelectControl
              control={control}
              name="isDarkMode"
              label=""
              options={[
                { label: "Dark", value: true },
                { label: "Light", value: false },
              ]}
              isSearchable={false}
            />
          </div>
        </OverrideFieldWrapper>
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
