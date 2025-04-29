import {
  Box,
  Button,
  Center,
  Skeleton,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import { extractMediaName } from "@repo/lib";
import {
  LoadingFull,
  OverlayToggle,
  PluginScaffold,
  Slide,
  SlideGrid,
  UniversalImage,
} from "@repo/ui";
import { useMemo } from "react";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { VscSettingsGear as VscSettingsGearRaw } from "react-icons/vsc";

import Renderer from "../Renderer";
import { usePluginAPI } from "../pluginApi";
import { trpc } from "../trpc";
import Landing from "./Landing";
import SettingsModal from "./SettingsModal";
import { SlidePicker } from "./SlidePicker";
import "./index.css";

const VscSettingsGear = chakra(VscSettingsGearRaw);

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
    <PluginScaffold
      title="Google Slides"
      postToolbar={
        <>
          <OverlayToggle
            toggler={({ onToggle }) => (
              <Button
                size="xs"
                bg="transparent"
                color="white"
                border="1px solid #ffffff6b"
                _hover={{ bg: "rgba(255, 255, 255, 0.13)" }}
                onClick={onToggle}
              >
                <VscSettingsGear />
                <Text ml={1} fontWeight="normal" fontSize="xs">
                  Settings
                </Text>
              </Button>
            )}
          >
            <SettingsModal />
          </OverlayToggle>
        </>
      }
      toolbar={
        <Stack
          direction="row"
          alignItems="center"
          columnGap={4}
          rowGap={2}
          flexWrap="wrap"
        >
          <SlidePicker
            onFileSelected={(data, token) => {
              const picker = google.picker;
              if (data[picker.Response.ACTION] === "picked") {
                if (
                  data[picker.Response.DOCUMENTS] &&
                  data[picker.Response.DOCUMENTS]!.length > 0
                ) {
                  const docs = data[picker.Response.DOCUMENTS]![0]!;

                  const id = docs[picker.Document.ID];

                  selectSlideMutation.mutate(
                    {
                      pluginId: pluginContext.pluginId,
                      presentationId: id,
                      token: token,
                    },
                    {
                      onError: (err) => {
                        pluginApi.log.error({ err }, "Error selecting slide");
                        pluginApi.remote.toast.error("Failed to select slide");
                      },
                    },
                  );
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
                if (mutableRendererData.slideIndex == null) {
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
                if (mutableRendererData.slideIndex == null) {
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
      }
      body={
        <Box p={3} width="100%">
          <SlideGrid>
            <RemoteHandler />
          </SlideGrid>

          <ResolvedSlideHandler />
        </Box>
      }
    />
  );
};

const ResolvedSlideHandler = () => {
  const pluginApi = usePluginAPI();
  const slideIndex = pluginApi.renderer.useData((x) => x.slideIndex);
  const displayMode = pluginApi.renderer.useData((x) => x.displayMode);

  if (displayMode === "image") {
    return null;
  }

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
      rendererData.displayMode === "image"
        ? (rendererData.slideIndex ?? 0) + (rendererData.clickCount ?? 0)
        : rendererData.resolvedSlideIndex !== null
          ? rendererData.resolvedSlideIndex
          : rendererData.slideIndex,
    [
      rendererData.clickCount,
      rendererData.displayMode,
      rendererData.resolvedSlideIndex,
      rendererData.slideIndex,
    ],
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
          {({ width }) =>
            thumbnailLinks?.[i] && thumbnailLinks[i] !== "" ? (
              <Center>
                <UniversalImage
                  src={extractMediaName(thumbnailLinks[i]!)}
                  imgProp={{ style: { width: "100%" } }}
                  width={width}
                />
              </Center>
            ) : (
              <Skeleton height="100%" />
            )
          }
        </Slide>
      ))}
    </>
  );
};

export default Remote;
