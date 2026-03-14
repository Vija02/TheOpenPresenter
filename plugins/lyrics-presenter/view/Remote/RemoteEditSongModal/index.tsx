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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useOverlayToggle,
} from "@repo/ui";
import { useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";

import { removeChords } from "../../../src/processLyrics";
import { Song, displayTypeSettings } from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { SongViewSlides } from "../SongViewSlides";
import { ArrangeTab } from "./ArrangeTab";
import { LyricFormLabel } from "./LyricFormLabel";
import { MobilePreview } from "./MobilePreview";
import SongEditEditor from "./SongEditEditor";
import { SongFormData, songFormValidator } from "./types";
import { useUpdateSectionOrderOnEdit } from "./useUpdateSectionOrderOnEdit";

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
    ({ title, content, ...setting }: SongFormData) => {
      const index = mutableSceneData.pluginData.songs.findIndex(
        (x) => x.id === song.id,
      );

      // If we're changing this song to sections and the current song is selected,
      // Then we want to reset the index to the first item
      if (
        setting.displayType === "sections" &&
        mutableSceneData.pluginData.songs[index]!.setting.displayType !==
          "sections" &&
        mutableRendererData.songId === song.id
      ) {
        mutableRendererData.currentIndex = 0;
      }

      // Convert empty sectionOrder to null (use default)
      const normalizedSetting = {
        ...setting,
        sectionOrder:
          setting.sectionOrder && setting.sectionOrder.length > 0
            ? setting.sectionOrder
            : null,
      };

      mutableSceneData.pluginData.songs[index]!.setting = normalizedSetting;
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

  const form = useForm<SongFormData>({
    resolver: zodResolver(songFormValidator),
    values: {
      ...song.setting,
      title: song.title,
      content: song.content,
    },
  });

  const data = form.watch();

  // Automatically update section order when section titles change
  useUpdateSectionOrderOnEdit(form);

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
        <DialogContent size="3xl" asChild className="gap-0 h-[85vh]">
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader className="px-3 md:px-6 pb-4">
              <DialogTitle>Edit song "{song.title}"</DialogTitle>
            </DialogHeader>
            <DialogBody className="px-3 md:px-6 pb-4">
              <Tabs defaultValue="content">
                <TabsList className="mb-2">
                  <TabsTrigger value="content">Content</TabsTrigger>
                  <TabsTrigger value="arrange">Arrange</TabsTrigger>
                </TabsList>

                <div className="flex flex-col md:flex-row gap-3">
                  <TabsContent value="content">
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
                                  removeChords(data.content.split("\n")).join(
                                    "\n",
                                  ),
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
                  </TabsContent>

                  <TabsContent value="arrange">
                    <ArrangeTab
                      content={data.content}
                      sectionOrder={data.sectionOrder ?? null}
                      onSectionOrderChange={(order: string[] | null) => {
                        form.setValue("sectionOrder", order);
                      }}
                    />
                  </TabsContent>

                  {/* Preview */}
                  <div className="stack-col basis-[200px] hidden md:block">
                    <h3 className="text-lg font-medium text-center mb-2">
                      Preview
                    </h3>
                    <SlideGrid forceWidth={200}>{preview}</SlideGrid>
                  </div>
                </div>
              </Tabs>
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
