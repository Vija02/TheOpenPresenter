import { Box, Grid, Link, Text } from "@chakra-ui/react";
import { useState } from "react";

import { trpc } from "../../trpc";

export const ImportPlaylist = ({
  setSelectedPlaylistSongIds,
}: {
  setSelectedPlaylistSongIds: React.Dispatch<
    React.SetStateAction<number[] | null>
  >;
}) => {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const { data: playlistData } = trpc.lyricsPresenter.playlist.useQuery();

  return (
    <Box>
      <Text fontSize="lg" fontWeight="600">
        Recent Playlist
      </Text>
      <Text pb={2} fontSize="xs">
        From{" "}
        <Link href="https://myworshiplist.com" color="blue.500" isExternal>
          MyWorshipList
        </Link>
      </Text>
      <Grid
        gridTemplateColumns="repeat(auto-fit, minmax(min(200px, 100%), 1fr))"
        gap={1}
      >
        {playlistData?.data.map((playlist: any) => (
          <Box
            key={playlist.id}
            p={1}
            cursor="pointer"
            _hover={{ bg: "gray.100" }}
            flex={1}
            whiteSpace="nowrap"
            border="1px solid"
            borderColor="gray.300"
            bg={selectedPlaylistId === playlist.id ? "gray.200" : "transparent"}
            onClick={() => {
              setSelectedPlaylistId(playlist.id);
              setSelectedPlaylistSongIds(
                playlistData.data
                  .find((x: any) => x.id === playlist.id)
                  .content.map((x: any) => x.id),
              );
            }}
          >
            <Text
              fontWeight="bold"
              fontSize="md"
              overflow="hidden"
              textOverflow="ellipsis"
            >
              {playlist?.title}
            </Text>
            <Box color="gray.800">
              {playlist.content.map((content: any) => (
                <Text
                  key={content.id}
                  textOverflow="ellipsis"
                  overflow="hidden"
                >
                  - {content.title}
                </Text>
              ))}
            </Box>
          </Box>
        ))}
      </Grid>
    </Box>
  );
};
