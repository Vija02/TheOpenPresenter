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
import ImportFileModal from "./ImportFile/ImportFileModal";
import Landing from "./Landing";
import SettingsModal from "./SettingsModal";
import "./index.css";

const VscSettingsGear = chakra(VscSettingsGearRaw);

const Remote = () => {
  const pluginApi = usePluginAPI();

  const mutableRendererData = pluginApi.renderer.useValtioData();

  const fetchId = pluginApi.scene.useData((x) => x.pluginData.fetchId);
  const isFetching = pluginApi.scene.useData((x) => x.pluginData._isFetching);

  if (!!isFetching && !fetchId) {
    return <LoadingFull />;
  }

  if (!fetchId) {
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
                <Text fontWeight="normal" fontSize="xs">
                  Replace Slide
                </Text>
              </Button>
            )}
          >
            <ImportFileModal />
          </OverlayToggle>

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
  const type = pluginApi.scene.useData((x) => x.pluginData.type);
  const slideIndex = pluginApi.renderer.useData((x) => x.slideIndex);
  const displayMode = pluginApi.renderer.useData((x) => x.displayMode);

  if (type === "pdf" || type === "ppt" || displayMode === "image") {
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
  const thumbnailLinks = pluginApi.scene.useData(
    (x) => x.pluginData.thumbnailLinks,
  );
  const type = pluginApi.scene.useData((x) => x.pluginData.type);
  const rendererData = pluginApi.renderer.useData((x) => x);

  const mutableRendererData = pluginApi.renderer.useValtioData();

  const actualSlideIndex = useMemo(
    () =>
      type === "pdf" || type === "ppt" || rendererData.displayMode === "image"
        ? (rendererData.slideIndex ?? 0) + (rendererData.clickCount ?? 0)
        : rendererData.resolvedSlideIndex !== null
          ? rendererData.resolvedSlideIndex
          : rendererData.slideIndex,
    [
      rendererData.clickCount,
      rendererData.displayMode,
      rendererData.resolvedSlideIndex,
      rendererData.slideIndex,
      type,
    ],
  );

  return (
    <>
      {thumbnailLinks.map((thumbnailLink, i) => (
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
            thumbnailLink && thumbnailLink !== "" ? (
              <Center>
                <UniversalImage
                  src={extractMediaName(thumbnailLink)}
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
