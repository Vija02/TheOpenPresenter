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
import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import {
  mergeLyricEdit,
  toLyricsOnly,
} from "../../../src/chords/mergeLyricEdit";
import { contentHasChords } from "../../../src/chords/song";
import { upgradeMwlChordCodes } from "../../../src/importer/upgradeChords";
import { removeChords } from "../../../src/processLyrics";
import { getMergedSlideStyle } from "../../../src/slideStyle";
import { Song, displayTypeSettings } from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { useSongbookSync } from "../../useSongbookSync";
import { SongViewSlides } from "../SongViewSlides";
import { ArrangeTab } from "./ArrangeTab";
import { ChordToolbar } from "./ChordToolbar";
import { ChordUpgradeNotice } from "./ChordUpgradeNotice";
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
  const { saveToSongbook } = useSongbookSync();

  const handleSubmit = useCallback(
    ({ title, content, key, ...setting }: SongFormData) => {
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
      mutableSceneData.pluginData.songs[index]!.key = key;

      if (song.songbookId) {
        void saveToSongbook({
          ...song,
          title,
          content,
          key,
          setting: normalizedSetting,
        });
      }

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
      saveToSongbook,
    ],
  );

  const originalContent = useMemo(
    () => (song.import?.importedData?.content ?? "").split("<br>").join("\n"),
    [song.import?.importedData?.content],
  );

  // Songs imported before we decoded chords still hold "x00" placeholders.
  // Upgrade them on open so the editor shows real chords; saving keeps it.
  const upgraded = useMemo(() => {
    const key = song.key ?? song.import?.importedData?.original_chord ?? null;
    return { content: upgradeMwlChordCodes(song.content, key), key };
  }, [song.content, song.key, song.import?.importedData?.original_chord]);

  const form = useForm<SongFormData>({
    resolver: zodResolver(songFormValidator),
    values: {
      ...song.setting,
      title: song.title,
      content: upgraded.content,
      key: upgraded.key,
    },
  });

  const data = form.watch();

  const [showChords, setShowChords] = useState(false);

  const hasChords = useMemo(
    () => contentHasChords(data.content),
    [data.content],
  );

  // What the editor shows. With chords hidden the user edits lyrics only, and
  // each change is merged back into the chorded content.
  const editorContent = useMemo(
    () => (showChords ? data.content : toLyricsOnly(data.content)),
    [data.content, showChords],
  );

  const handleEditorChange = useCallback(
    (value: string) => {
      form.setValue(
        "content",
        showChords ? value : mergeLyricEdit(data.content, value),
      );
    },
    [data.content, form, showChords],
  );

  // Automatically update section order when section titles change
  useUpdateSectionOrderOnEdit(form);

  const mergedSlideStyle = useMemo(
    () => getMergedSlideStyle(slideStyle, song.styleOverride),
    [slideStyle, song.styleOverride],
  );

  const preview = useMemo(
    () => (
      <SongViewSlides
        song={{
          ...song,
          setting: data,
          content: data.content,
        }}
        slideStyle={mergedSlideStyle}
        isPreview
      />
    ),
    [data, mergedSlideStyle, song],
  );

  return (
    <Dialog
      open={isOpen ?? false}
      onOpenChange={onToggle ?? (() => {})}
      {...props}
    >
      <Form {...form}>
        <DialogContent
          size="3xl"
          className="gap-0 h-[85vh]"
          render={<form onSubmit={form.handleSubmit(handleSubmit)} />}
        >
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
                            content={data.content}
                            hasChords={hasChords}
                            showChords={showChords}
                            onToggleShowChords={() =>
                              setShowChords((shown) => !shown)
                            }
                            onFormatted={(val) => {
                              form.setValue("content", val);
                            }}
                            canReset={data.content !== originalContent}
                            onReset={() => {
                              form.setValue("content", originalContent);
                            }}
                          />
                          {hasChords && showChords && (
                            <>
                              <ChordUpgradeNotice
                                song={song}
                                onUpgrade={(val, newKey) => {
                                  form.setValue("content", val);
                                  form.setValue("key", newKey);
                                }}
                              />
                              <ChordToolbar
                                content={data.content}
                                songKey={data.key}
                                onChange={(val, newKey) => {
                                  form.setValue("content", val);
                                  form.setValue("key", newKey);
                                }}
                                onRemoveChords={() => {
                                  form.setValue(
                                    "content",
                                    removeChords(data.content.split("\n")).join(
                                      "\n",
                                    ),
                                  );
                                }}
                              />
                            </>
                          )}
                          <FormControl>
                            <SongEditEditor
                              initialContent={editorContent
                                .split("\n")
                                .map((x) => `<p>${x}</p>`)
                                .join("")}
                              onChange={handleEditorChange}
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
                  <SlideGrid pluginAPI={pluginApi} forceWidth={200}>
                    {preview}
                  </SlideGrid>
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
        </DialogContent>
      </Form>
    </Dialog>
  );
};

export default RemoteEditSongModal;
