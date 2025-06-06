import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  InputControl,
  SlideGrid,
} from "@repo/ui";
import { Formik } from "formik";
import { SelectControl } from "formik-chakra-ui";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toFormikValidationSchema } from "zod-formik-adapter";

import { removeChords } from "../../../src/processLyrics";
import {
  DisplayType,
  Song,
  displayTypeSettings,
  songSettingValidator,
} from "../../../src/types";
import { usePluginAPI } from "../../pluginApi";
import { LyricFormLabel } from "../RemoteEditSongModal/LyricFormLabel";
import SongEditEditor from "../RemoteEditSongModal/SongEditEditor";
import { SongViewSlides } from "../SongViewSlides";

export const CreateNewSong = ({
  onChange,
}: {
  onChange: (song: Song) => void;
}) => {
  const pluginApi = usePluginAPI();
  const slideStyle = pluginApi.scene.useData((x) => x.pluginData.style) ?? {};

  const form = useForm({
    resolver: zodResolver(
      z.object({
        ...songSettingValidator.shape,
        title: z.string(),
        content: z.string(),
      }),
    ),
    defaultValues: {
      title: "",
      content: "[Verse 1]\n\n\n[Chorus]\n\n\n[Bridge]\n",
      displayType: "sections" as DisplayType,
    },
    mode: "onChange",
  });

  const data = form.watch();

  const previewSong: Song = useMemo(
    () => ({
      id: "",
      title: data.title,
      _imported: false,
      setting: { displayType: data.displayType },
      content: data.content,
    }),
    [data.content, data.displayType, data.title],
  );

  useEffect(() => {
    if (form.formState.isValid && !form.formState.isValidating) {
      onChange(previewSong);
    }
  }, [
    data,
    form.formState.isValid,
    form.formState.isValidating,
    onChange,
    previewSong,
  ]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(() => {})}>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="stack-col flex-1 items-start">
            <InputControl name="title" label="Title" control={form.control} />
            {/* <SelectControl name="displayType" label="Display Type">
                    {Object.entries(displayTypeSettings).map(
                      ([key, { label }]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ),
                    )}
                  </SelectControl> */}

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
                    canReset={false}
                    onReset={() => {}}
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
          <div className="hidden md:block stack-col basis-52">
            <h3 className="text-lg font-medium text-center mb-2">Preview</h3>
            <SlideGrid forceWidth={200}>
              <SongViewSlides
                song={previewSong}
                slideStyle={slideStyle}
                isPreview
              />
            </SlideGrid>
          </div>
        </div>
      </form>
    </Form>
  );
};
