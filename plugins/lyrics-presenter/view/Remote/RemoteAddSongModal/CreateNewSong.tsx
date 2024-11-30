import { Flex, Heading, Show, VStack } from "@chakra-ui/react";
import { Formik } from "formik";
import { InputControl, SelectControl } from "formik-chakra-ui";
import { useEffect } from "react";
import { toFormikValidationSchema } from "zod-formik-adapter";

import { removeChords } from "../../../src/processLyrics";
import {
  DisplayType,
  Song,
  displayTypeSettings,
  songSettingValidator,
} from "../../../src/types";
import { LyricFormLabel } from "../RemoteEditSongModal/LyricFormLabel";
import SongEditEditor from "../RemoteEditSongModal/SongEditEditor";
import { SongViewSlides } from "../SongViewSlides";

// https://github.com/jaredpalmer/formik/issues/271#issuecomment-1047208078
const FormikListener = ({ values, callback }: any) => {
  useEffect(() => {
    callback(values);
  }, [callback, values]);

  return null;
};

export const CreateNewSong = ({
  onChange,
}: {
  onChange: (song: Song) => void;
}) => {
  return (
    <Formik
      initialValues={{
        title: "",
        content: "[Verse 1]\n\n\n[Chorus]\n\n\n[Bridge]\n",
        displayType: "sections" as DisplayType,
      }}
      validationSchema={toFormikValidationSchema(songSettingValidator)}
      onSubmit={() => {}}
    >
      {({ values, setFieldValue }) => {
        const previewSong: Song = {
          id: "",
          title: values.title,
          _imported: false,
          setting: { displayType: values.displayType },
          content: values.content,
        };

        return (
          <Flex flexDir={{ base: "column", md: "row" }} gap={3}>
            <FormikListener
              values={values}
              callback={() => onChange(previewSong)}
            />
            <VStack flex={1} alignItems="flex-start">
              <InputControl name="title" label="Title" />
              <SelectControl name="displayType" label="Display Type">
                {Object.entries(displayTypeSettings).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </SelectControl>

              <LyricFormLabel
                onRemoveChords={() => {
                  setFieldValue(
                    "content",
                    removeChords(values.content.split("\n")).join("\n"),
                  );
                }}
                canReset={false}
                onReset={() => {}}
              />
              <SongEditEditor
                initialContent={values.content
                  .split("\n")
                  .map((x) => `<p>${x}</p>`)
                  .join("")}
                onChange={(val) => {
                  setFieldValue("content", val);
                }}
              />
            </VStack>
            <Show above="md">
              <VStack flexBasis="200px">
                <Heading fontSize="lg">Preview</Heading>
                <SongViewSlides song={previewSong} isPreview />
              </VStack>
            </Show>
          </Flex>
        );
      }}
    </Formik>
  );
};
