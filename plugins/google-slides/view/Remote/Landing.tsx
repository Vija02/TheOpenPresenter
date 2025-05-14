import { Center, Heading, Stack } from "@chakra-ui/react";

import { ImportFilePicker } from "./ImportFile/ImportFilePicker";

const Landing = () => {
  return (
    <Center mt={10} p={2}>
      <Stack>
        <Heading textAlign="center" mb={4}>
          Welcome to Slides Presenter
        </Heading>

        <ImportFilePicker />
      </Stack>
    </Center>
  );
};
export default Landing;
