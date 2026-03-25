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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { getMergedSlideStyle, getSlideStyle } from "../../../src/slideStyle";
import { SlideStyle, Song, slideStyleValidator } from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { MobilePreview } from "../RemoteEditSongModal/MobilePreview";
import { SongViewSlides } from "../SongViewSlides";
import {
  StyleFields,
  StylePreviewControls,
} from "../StyleSettingModal/StyleFields";

export type SongStyleOverrideModalProps = {
  song: Song;
};

const SongStyleOverrideModal = ({ song }: SongStyleOverrideModalProps) => {
  const { isOpen, onToggle, resetData } = useOverlayToggle();

  const pluginApi = usePluginAPI();
  const rawglobalStyle = pluginApi.scene.useData((x) => x.pluginData.style);
  const mutableSceneData = pluginApi.scene.useValtioData();

  const globalStyle = useMemo(
    () => getSlideStyle(rawglobalStyle),
    [rawglobalStyle],
  );

  const [localOverride, setLocalOverride] = useState<SlideStyle | null>(
    song.styleOverride ?? null,
  );

  const baseMergedStyle = useMemo(
    () => getMergedSlideStyle(globalStyle, song.styleOverride),
    [globalStyle, song.styleOverride],
  );

  const form = useForm<SlideStyle>({
    resolver: zodResolver(slideStyleValidator) as any,
    values: { ...baseMergedStyle, debugPadding: true },
  });

  const data = form.watch();

  const prevDataRef = useRef(data);
  const resettingFieldsRef = useRef<Set<keyof SlideStyle>>(new Set());

  useEffect(() => {
    const prevData = prevDataRef.current;
    prevDataRef.current = data;

    // Check each field for changes and mark as overridden
    (Object.keys(data) as (keyof SlideStyle)[]).forEach((key) => {
      if (key === "debugPadding") return;
      // Skip if this field is being reset
      if (resettingFieldsRef.current.has(key)) {
        resettingFieldsRef.current.delete(key);
        return;
      }
      if (data[key] !== prevData[key]) {
        setLocalOverride((prev) => ({
          ...(prev ?? {}),
          [key]: data[key],
        }));
      }
    });
  }, [data]);

  const hasOverrides = useMemo(() => {
    return (
      localOverride && Object.values(localOverride).some((v) => v !== undefined)
    );
  }, [localOverride]);

  const handleSubmit = useCallback(() => {
    const index = mutableSceneData.pluginData.songs.findIndex(
      (x) => x.id === song.id,
    );

    if (index === -1) return;

    const formValues = form.getValues();
    const cleanedOverride: SlideStyle = {};

    // Only include fields that differ from the global style
    (Object.keys(formValues) as (keyof SlideStyle)[]).forEach((key) => {
      if (key === "debugPadding") return;

      const formValue = formValues[key];
      const globalValue = globalStyle?.[key];

      // If the value differs from global, include it in the override
      if (formValue !== globalValue && formValue !== undefined) {
        (cleanedOverride as any)[key] = formValue;
      }
    });

    const hasOverrides = Object.keys(cleanedOverride).length > 0;
    mutableSceneData.pluginData.songs[index]!.styleOverride = hasOverrides
      ? cleanedOverride
      : null;

    resetData?.();
    onToggle?.();
  }, [
    mutableSceneData.pluginData.songs,
    song.id,
    onToggle,
    resetData,
    form,
    globalStyle,
  ]);

  const handleResetFields = useCallback(
    (fieldNames: (keyof SlideStyle)[]) => {
      fieldNames.forEach((fieldName) => {
        resettingFieldsRef.current.add(fieldName);
      });

      setLocalOverride((prev) => {
        if (!prev) return null;

        const newOverride: SlideStyle = {};
        (Object.keys(prev) as (keyof SlideStyle)[]).forEach((key) => {
          if (!fieldNames.includes(key) && prev[key] !== undefined) {
            (newOverride as any)[key] = prev[key];
          }
        });

        const hasRemaining = Object.keys(newOverride).length > 0;
        return hasRemaining ? newOverride : null;
      });

      const globalMerged = getMergedSlideStyle(globalStyle, null);
      fieldNames.forEach((fieldName) => {
        form.setValue(fieldName, globalMerged[fieldName]);
      });
    },
    [globalStyle, form],
  );

  const handleSetValue: typeof form.setValue = useCallback(
    (name, value, options) => {
      form.setValue(name, value, options);

      setLocalOverride((prev) => ({
        ...(prev ?? {}),
        [name]: value,
      }));
    },
    [form],
  );

  const handleResetAll = useCallback(() => {
    (Object.keys(data) as (keyof SlideStyle)[]).forEach((key) => {
      if (key !== "debugPadding") {
        resettingFieldsRef.current.add(key);
      }
    });

    setLocalOverride(null);
    const globalMerged = getMergedSlideStyle(globalStyle, null);
    form.reset({ ...globalMerged, debugPadding: true });
  }, [form, globalStyle, data]);

  const previewSlideStyle = useMemo(
    () => getMergedSlideStyle(globalStyle, data),
    [globalStyle, data],
  );

  const preview = useMemo(
    () => (
      <SongViewSlides song={song} slideStyle={previewSlideStyle} isPreview />
    ),
    [song, previewSlideStyle],
  );

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <Form {...form}>
        <DialogContent size="3xl" asChild>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            <DialogHeader className="px-3 md:px-6">
              <DialogTitle>Style Override - "{song.title}"</DialogTitle>
            </DialogHeader>
            <DialogBody className="px-3 md:px-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <StyleFields
                    control={form.control}
                    data={data}
                    setValue={handleSetValue}
                    isOverrideMode
                    currentOverride={localOverride}
                    onResetFields={handleResetFields}
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
                <div className="stack-row px-3 md:px-6 pt-3 justify-between">
                  <div>
                    {hasOverrides && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResetAll}
                      >
                        Reset All to Global
                      </Button>
                    )}
                  </div>
                  <div className="stack-row">
                    <Button type="submit" variant="success">
                      Save
                    </Button>
                    <Button type="button" variant="outline" onClick={onToggle}>
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Form>
    </Dialog>
  );
};

export default SongStyleOverrideModal;
