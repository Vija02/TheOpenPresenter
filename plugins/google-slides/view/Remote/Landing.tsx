import { Button, Center, Heading, Stack, Text } from "@chakra-ui/react";
import { VscAdd } from "react-icons/vsc";

import { usePluginAPI } from "../pluginApi";
import { trpc } from "../trpc";
import { SlidePicker } from "./SlidePicker";

const Landing = () => {
  const pluginApi = usePluginAPI();
  const pluginContext = pluginApi.pluginContext;

  const mutableSceneData = pluginApi.scene.useValtioData();

  const selectSlideMutation = trpc.googleslides.selectSlide.useMutation();

  return (
    <Center mt={10} p={2}>
      <Stack>
        <Heading textAlign="center" mb={4}>
          Welcome to Google Slides Presenter
        </Heading>

        <SlidePicker
          onFileSelected={(data, token) => {
            const picker = google.picker;
            if (data[picker.Response.ACTION] === "picked") {
              if (data[picker.Response.DOCUMENTS].length > 0) {
                const docs = data[picker.Response.DOCUMENTS][0]!;

                const id = docs[picker.Document.ID];

                selectSlideMutation.mutate({
                  pluginId: pluginContext.pluginId,
                  presentationId: id,
                  token: token,
                });
                mutableSceneData.pluginData._isFetching = true;
              }
            }
          }}
        >
          {({ isLoading, openPicker }) => (
            <Button
              p={1}
              cursor="pointer"
              onClick={openPicker}
              colorScheme="green"
              isLoading={isLoading}
            >
              <VscAdd />
              <Text ml={2}>Select a Google Slide to import</Text>
            </Button>
          )}
        </SlidePicker>
      </Stack>
    </Center>
  );
};
export default Landing;
