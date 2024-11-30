import {
  ListItem,
  OrderedList,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverHeader,
  Text,
} from "@chakra-ui/react";

// TODO: Make this clearer & using modal/drawer
export const SongEditInfo = () => {
  return (
    <PopoverContent
      width="100%"
      maxW="100vw"
      color="white"
      bg="blue.800"
      borderColor="blue.800"
    >
      <PopoverHeader pt={4} fontWeight="bold" border="0">
        Formatting songs
      </PopoverHeader>
      <PopoverArrow bg="blue.800" />
      <PopoverCloseButton />
      <PopoverBody mb={3}>
        We use quite a simple format to show songs inspired by OpenSong. <br />
        <br />
        Here are some of the basic rules: <br />
        <OrderedList>
          <ListItem>
            Separate sections with square brackets(<Text as="b">[ ]</Text>) like{" "}
            <Text as="b">[Verse 1]</Text>.
            <br />
            This can be anything from Verse, Chorus, Bridge, and any text you
            like.
          </ListItem>
          <ListItem>
            Use a single dash(<Text as="b">-</Text>) to split your section into
            multiple slides.
          </ListItem>
          <ListItem>
            Add a dot(<Text as="b">.</Text>) in front of a line to indicate that
            it is a chord line.
            <br />
            Note: At this time, we do not support showing chords yet.
          </ListItem>
        </OrderedList>
      </PopoverBody>
    </PopoverContent>
  );
};
