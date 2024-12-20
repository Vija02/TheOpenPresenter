import {
  Box,
  Center,
  Grid,
  Image,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Skeleton,
  Stack,
  Text,
} from "@chakra-ui/react";
import { LoadingInline, OverlayToggleComponentProps } from "@repo/ui";
import { FaYoutube } from "react-icons/fa";
import type { YTNodes } from "youtubei.js";

import { trpc } from "../trpc";

export type YoutubeSearchModalPropTypes = Omit<
  ModalProps,
  "isOpen" | "onClose" | "children"
> &
  Partial<OverlayToggleComponentProps> & {
    searchQuery: string;
    onVideoSelect: (videoId: string) => void;
  };

const YoutubeSearchModal = ({
  isOpen,
  onToggle,
  resetData,
  searchQuery,
  onVideoSelect,
  ...props
}: YoutubeSearchModalPropTypes) => {
  const { data, isLoading } = trpc.videoPlayer.search.useQuery(
    {
      title: searchQuery,
    },
    { enabled: isOpen },
  );

  const onSelect = (videoId: string) => {
    onVideoSelect(videoId);
    onToggle?.();
    resetData?.();
  };

  return (
    <Modal
      size="xl"
      isOpen={isOpen ?? false}
      onClose={onToggle ?? (() => {})}
      {...props}
    >
      <ModalOverlay />
      <ModalContent maxW="1200" minH="70%">
        <ModalHeader>
          <Stack direction="row" alignItems="center">
            <FaYoutube color="red" fontSize={24} />
            <Text>Youtube Search</Text>
          </Stack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {data && data.results.length === 0 && (
            <Text my={10} color="gray.800" textAlign="center">
              No results found.
            </Text>
          )}
          <Grid
            gridTemplateColumns={{
              base: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(3, 1fr)",
              lg: "repeat(4, 1fr)",
            }}
            gap={2}
          >
            {isLoading &&
              Array.from(new Array(9)).map((_, i) => (
                <Stack key={i} direction="column">
                  <Skeleton aspectRatio={16 / 9} />
                  <Skeleton height="20px" width="80%" mb="4px" />
                  <Skeleton height="10px" maxW="71px" />
                  <Skeleton height="10px" maxW="118px" />
                </Stack>
              ))}
            {data &&
              data.results
                .filter((result: any) => result.type === "Video")
                .map((result: YTNodes.Video) => {
                  const res = result as YTNodes.Video;

                  return (
                    <Box
                      p={1}
                      pb={4}
                      cursor="pointer"
                      _hover={{ bg: "#f4f4f4" }}
                      onClick={() => onSelect(res.id)}
                    >
                      <Box position="relative">
                        <Image
                          src={res.thumbnails[res.thumbnails.length - 1]?.url}
                          aspectRatio={16 / 9}
                          width="100%"
                        />
                        {res.thumbnail_overlays.find(
                          (x) => x.type === "ThumbnailOverlayTimeStatus",
                        ) && (
                          <Box
                            position="absolute"
                            bottom={2}
                            right={2}
                            bg="rgb(28, 28, 28)"
                            opacity={0.9}
                            color="white"
                            rounded="sm"
                            px={1}
                            fontSize="xs"
                            fontWeight="600"
                          >
                            {
                              (res.thumbnail_overlays.find(
                                (x) => x.type === "ThumbnailOverlayTimeStatus",
                              ) as YTNodes.ThumbnailOverlayTimeStatus)!.text
                            }
                          </Box>
                        )}
                      </Box>
                      <Text
                        mt={2}
                        mb={1}
                        fontSize="md"
                        overflow="hidden"
                        display="-webkit-box"
                        sx={{
                          lineClamp: 2,
                          "-webkit-line-clamp": "2",
                          boxOrient: "vertical",
                          "-webkit-box-orient": "vertical",
                        }}
                        textOverflow="ellipsis"
                      >
                        {res.title.text}
                      </Text>
                      <Text color="gray.600">{res.author.name}</Text>
                      <Stack color="gray.600" direction="row">
                        <Text>{res.short_view_count.text}</Text>
                        <Text>•</Text>
                        <Text>{res.published.text}</Text>
                      </Stack>
                    </Box>
                  );
                })}
          </Grid>
        </ModalBody>

        <ModalFooter></ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default YoutubeSearchModal;
