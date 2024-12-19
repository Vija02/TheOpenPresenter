import { Button, Input, Stack, Text } from "@chakra-ui/react";
import { useEffect, useRef } from "react";
import { AiOutlineImport } from "react-icons/ai";
import { FaPlus } from "react-icons/fa";

import { Mode } from ".";

export const LandingAddSong = ({
  onSetMode,
  onSearch,
}: {
  onSetMode: (mode: Mode) => void;
  onSearch: (text: string) => void;
}) => {
  const focusElement = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void (focusElement.current && focusElement.current!.focus());
  }, [focusElement]);

  return (
    <Stack>
      <Stack alignItems="center">
        <Text fontWeight="bold">Search existing songs</Text>
        <Input
          ref={focusElement}
          maxW="xl"
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Song title..."
        />
      </Stack>

      <Text color="gray.500" textAlign="center">
        or
      </Text>

      <Button
        size="sm"
        colorScheme="green"
        onClick={() => onSetMode(Mode.CREATE_SONG)}
      >
        <FaPlus />
        <Text ml={2}>Create a new song</Text>
      </Button>

      <Text color="gray.500" textAlign="center">
        or
      </Text>

      <Button
        size="sm"
        variant="outline"
        onClick={() => onSetMode(Mode.IMPORT_PLAYLIST)}
      >
        <AiOutlineImport />
        <Text ml={2}>Import from existing playlist</Text>
      </Button>
    </Stack>
  );
};
