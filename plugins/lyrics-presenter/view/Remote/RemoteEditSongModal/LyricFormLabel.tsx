import {
  Button,
  FormLabel,
  Popover,
  PopoverTrigger,
  Stack,
  Text,
} from "@chakra-ui/react";
import { FaCircleInfo } from "react-icons/fa6";

import { SongEditInfo } from "./SongEditInfo";

export const LyricFormLabel = ({
  canReset,
  onRemoveChords,
  onReset,
}: {
  canReset: boolean;
  onRemoveChords: () => void;
  onReset: () => void;
}) => {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      width="100%"
    >
      <FormLabel mb={0} display="flex" gap={3} alignItems="center">
        Lyric{" "}
        <Popover>
          <PopoverTrigger>
            <Button size="xs" variant="outline">
              <FaCircleInfo color="gray" />
              <Text ml={2} fontWeight="light">
                How does this work?
              </Text>
            </Button>
          </PopoverTrigger>
          <SongEditInfo />
        </Popover>
      </FormLabel>
      <Stack direction="row" alignItems="center">
        <Button size="xs" onClick={onRemoveChords}>
          Remove chords
        </Button>
        {canReset && (
          <Button size="xs" onClick={onReset}>
            Reset
          </Button>
        )}
      </Stack>
    </Stack>
  );
};
