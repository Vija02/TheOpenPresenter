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
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  InputControl,
  OptionControl,
  SlideGrid,
  useOverlayToggle,
} from "@repo/ui";
import { useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { removeChords } from "../../../src/processLyrics";
import {
  Song,
  SongSetting,
  displayTypeSettings,
  songSettingValidator,
} from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { SongViewSlides } from "../SongViewSlides";
import { LyricFormLabel } from "./LyricFormLabel";
import { MobilePreview } from "./MobilePreview";
import SongEditEditor from "./SongEditEditor";

export type RemoteEditSongModalPropTypes = { song: Song };

const RemoteEditSongModal = ({
  song,
  ...props
}: RemoteEditSongModalPropTypes) => {
  const { isOpen, onToggle, resetData } = useOverlayToggle();

  const pluginApi = usePluginAPI();
  const slideStyle = pluginApi.scene.useData((x) => x.pluginData.style);
  const mutableSceneData = pluginApi.scene.useValtioData();
  const mutableRendererData = pluginApi.renderer.useValtioData();

  const handleSubmit = useCallback(
    ({
      title,
      content,
      ...data
    }: SongSetting & Pick<Song, "title" | "content">) => {
      const index = mutableSceneData.pluginData.songs.findIndex(
        (x) => x.id === song.id,
      );

      // If we're changing this song to sections and the current song is selected,
      // Then we want to reset the index to the first item
      if (
        data.displayType === "sections" &&
        mutableSceneData.pluginData.songs[index]!.setting.displayType !==
          "sections" &&
        mutableRendererData.songId === song.id
      ) {
        mutableRendererData.currentIndex = 0;
      }

      mutableSceneData.pluginData.songs[index]!.setting = data;
      mutableSceneData.pluginData.songs[index]!.title = title;
      mutableSceneData.pluginData.songs[index]!.content = content;

      resetData?.();
      onToggle?.();
      return Promise.resolve();
    },
    [
      mutableRendererData,
      mutableSceneData.pluginData.songs,
      onToggle,
      resetData,
      song,
    ],
  );

  const originalContent = useMemo(
    () => (song.import?.importedData?.content ?? "").split("<br>").join("\n"),
    [song.import?.importedData?.content],
  );

  const form = useForm({
    resolver: zodResolver(
      z.object({
        ...songSettingValidator.shape,
        title: z.string(),
        content: z.string(),
      }),
    ),
    values: {
      ...song.setting,
      title: song.title,
      content: song.content,
    },
  });

  const data = form.watch();

  const preview = useMemo(
    () => (
      <SongViewSlides
        song={{
          ...song,
          setting: data,
          content: data.content,
        }}
        slideStyle={slideStyle ?? {}}
        isPreview
      />
    ),
    [data, slideStyle, song],
  );

  return (
    <Dialog
      open={isOpen ?? false}
      onOpenChange={onToggle ?? (() => {})}
      {...props}
    >
      <Form {...form}>
        <DialogContent size="3xl" asChild className="gap-0">
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader className="px-3 md:px-6 pb-4">
              <DialogTitle>Edit song "{song.title}"</DialogTitle>
            </DialogHeader>
            <DialogBody className="px-3 md:px-6 pb-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="stack-col flex-1 items-start">
                  <InputControl
                    name="title"
                    label="Title"
                    control={form.control}
                  />
                  <OptionControl
                    name="displayType"
                    label="Display Type"
                    control={form.control}
                    options={Object.entries(displayTypeSettings).map(
                      ([key, { label, description }]) => ({
                        title: label,
                        description,
                        value: key,
                      }),
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <LyricFormLabel
                          onRemoveChords={() => {
                            form.setValue(
                              "content",
                              removeChords(data.content.split("\n")).join("\n"),
                            );
                          }}
                          canReset={data.content !== originalContent}
                          onReset={() => {
                            form.setValue("content", originalContent);
                          }}
                        />
                        <FormControl>
                          <SongEditEditor
                            initialContent={data.content
                              .split("\n")
                              .map((x) => `<p>${x}</p>`)
                              .join("")}
                            onChange={(val) => {
                              form.setValue("content", val);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="stack-col basis-[200px] hidden md:block">
                  <h3 className="text-lg font-medium text-center mb-2">
                    Preview
                  </h3>
                  <SlideGrid forceWidth={200}>{preview}</SlideGrid>
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

export default RemoteEditSongModal;
