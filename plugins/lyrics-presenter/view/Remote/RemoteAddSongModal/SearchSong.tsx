import { Box, Flex, Input, Stack, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { useDebounce } from "use-debounce";

import { trpc } from "../../trpc";

export const SearchSong = ({
  initialValue,
  selectedSongId,
  setSelectedSongId,
}: {
  initialValue: string | null;
  selectedSongId: number | null;
  setSelectedSongId: React.Dispatch<React.SetStateAction<number | null>>;
}) => {
  const [selectedSource, setSelectedSource] = useState("Any");

  const [searchInput, setSearchInput] = useState(initialValue ?? "");
  const [debouncedSearchInput] = useDebounce(searchInput, 200);

  const { data: songData } = trpc.lyricsPresenter.search.useQuery({
    title: debouncedSearchInput,
  });

  const focusElement = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void (focusElement.current && focusElement.current!.focus());
  }, [focusElement]);

  return (
    <Flex>
      <Stack
        display={{ base: "none", sm: "flex" }}
        pr={4}
        borderRight="1px solid rgb(0, 0, 0, 0.1)"
        spacing={0}
      >
        <Text fontWeight="bold" mb={2}>
          Sources
        </Text>
        {["Any", "MyWorshipList"].map((source) => (
          <Box
            key={source}
            bg={source === selectedSource ? "blue.50" : ""}
            px={2}
            py={1}
            cursor="pointer"
            _hover={{ bg: "blue.50" }}
            onClick={() => {
              setSelectedSource(source);
            }}
          >
            <Text>{source}</Text>
          </Box>
        ))}
        <Text fontSize="xs" textAlign="center" color="gray.400" pt={4}>
          More coming soon...
        </Text>
      </Stack>
      <Stack pl={{ base: "", sm: "4" }} width="100%">
        <Input
          ref={focusElement}
          mb={2}
          placeholder="Search a song..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Box>
          {songData?.data.map((x: any) => (
            <Box
              key={x.id}
              bg={selectedSongId === x.id ? "gray.200" : "transparent"}
              _hover={{ bg: "gray.100" }}
              cursor="pointer"
              onClick={() => {
                setSelectedSongId(x.id);
              }}
              py={1}
              px={1}
            >
              <Text fontSize="md" lineHeight={1}>
                {x.title}
              </Text>
              <Text fontSize="xs" color="gray.500">
                {x.author}
              </Text>
            </Box>
          ))}
        </Box>
      </Stack>
    </Flex>
  );
};
