import {
  Box,
  Button,
  Center,
  Image,
  Skeleton,
  Stack,
  Text,
} from "@chakra-ui/react";
import { LoadingFull, Slide, SlideGrid } from "@repo/ui";
import { useMemo } from "react";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";

import Renderer from "../Renderer";
import { usePluginAPI } from "../pluginApi";
import { trpc } from "../trpc";
import Landing from "./Landing";
import { SlidePicker } from "./SlidePicker";
import "./index.css";

const Remote = () => {
  const pluginApi = usePluginAPI();
  const pluginContext = pluginApi.pluginContext;

  const mutableRendererData = pluginApi.renderer.useValtioData();

  const html = pluginApi.scene.useData((x) => x.pluginData.html);
  const isFetching = pluginApi.scene.useData((x) => x.pluginData._isFetching);

  const selectSlideMutation = trpc.googleslides.selectSlide.useMutation();

  if (!!isFetching && !html) {
    return <LoadingFull />;
  }

  if (!html) {
    return <Landing />;
  }

  return (
    <Box>
      <Box p={3} bg="gray.900">
        <Stack
          direction="row"
          alignItems="center"
          gap={{ base: 2, md: 5 }}
          flexWrap="wrap"
        >
          <Stack direction="row" alignItems="center">
            <Text fontWeight="bold" color="white">
              <Text>Google Slides</Text>
            </Text>
          </Stack>
          <Stack
            direction="row"
            alignItems="center"
            spacing={2}
            flexWrap="wrap"
          >
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
                  }
                }
              }}
            >
              {({ isLoading, openPicker }) => (
                <Button
                  size="xs"
                  bg="transparent"
                  color="white"
                  border="1px solid #ffffff6b"
                  _hover={{ bg: "rgba(255, 255, 255, 0.13)" }}
                  onClick={openPicker}
                  isLoading={isLoading}
                >
                  <Text fontWeight="normal" fontSize="xs">
                    Replace Slide
                  </Text>
                </Button>
              )}
            </SlidePicker>

            <Stack direction="row" alignItems="center">
              <Text
                display={{ base: "none", sm: "inherit" }}
                fontWeight="bold"
                color="white"
                pl={4}
                fontSize="xs"
              >
                Navigate:
              </Text>
              <Button
                size="xs"
                bg="transparent"
                color="white"
                border="1px solid #ffffff6b"
                _hover={{ bg: "rgba(255, 255, 255, 0.13)" }}
                onClick={() => {
                  if (!mutableRendererData.slideIndex) {
                    mutableRendererData.slideIndex = 0;
                  } else {
                    mutableRendererData.clickCount =
                      (mutableRendererData.clickCount ?? 0) - 1;
                  }
                }}
              >
                <FaArrowLeft />
                <Text ml={1} fontWeight="normal" fontSize="xs">
                  Left
                </Text>
              </Button>
              <Button
                size="xs"
                bg="transparent"
                color="white"
                border="1px solid #ffffff6b"
                _hover={{ bg: "rgba(255, 255, 255, 0.13)" }}
                onClick={() => {
                  if (!mutableRendererData.slideIndex) {
                    mutableRendererData.slideIndex = 0;
                  } else {
                    mutableRendererData.clickCount =
                      (mutableRendererData.clickCount ?? 0) + 1;
                  }
                }}
              >
                <FaArrowRight />{" "}
                <Text ml={1} fontWeight="normal" fontSize="xs">
                  Right
                </Text>
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Box>

      <Box p={3}>
        <SlideGrid>
          <RemoteHandler />
        </SlideGrid>

        <ResolvedSlideHandler />
      </Box>
    </Box>
  );
};

const ResolvedSlideHandler = () => {
  const pluginApi = usePluginAPI();
  const slideIndex = pluginApi.renderer.useData((x) => x.slideIndex);

  // We render this to calculate what slide is currently selected through clicking
  return (
    <Box className="content-hidden">
      {slideIndex !== undefined && slideIndex !== null && (
        <Renderer shouldUpdateResolvedSlideIndex />
      )}
    </Box>
  );
};

const RemoteHandler = () => {
  const pluginApi = usePluginAPI();
  const pageIds = pluginApi.scene.useData((x) => x.pluginData.pageIds);
  const thumbnailLinks = pluginApi.scene.useData(
    (x) => x.pluginData.thumbnailLinks,
  );
  const rendererData = pluginApi.renderer.useData((x) => x);

  const mutableRendererData = pluginApi.renderer.useValtioData();

  const actualSlideIndex = useMemo(
    () =>
      rendererData.resolvedSlideIndex !== null
        ? rendererData.resolvedSlideIndex
        : rendererData.slideIndex,
    [rendererData.resolvedSlideIndex, rendererData.slideIndex],
  );

  return (
    <>
      {pageIds.map((x, i) => (
        <Slide
          key={i}
          heading={`Slide ${i + 1}`}
          isActive={i === actualSlideIndex}
          onClick={() => {
            mutableRendererData.slideIndex = i;
            mutableRendererData.clickCount = null;
            mutableRendererData.resolvedSlideIndex = null;
            pluginApi.renderer.setRenderCurrentScene();
          }}
        >
          {thumbnailLinks?.[i] ? (
            <Center>
              <Image
                src={pluginApi.media.getUrl(thumbnailLinks[i]!)}
                width="100%"
              />
            </Center>
          ) : (
            <Skeleton height="100%" />
          )}
        </Slide>
      ))}
    </>
  );
};

export default Remote;
