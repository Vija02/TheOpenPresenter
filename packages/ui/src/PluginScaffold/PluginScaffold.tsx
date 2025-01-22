import { Box, Flex, Stack, Text } from "@chakra-ui/react";

type PluginScaffoldPropTypes = {
  title: string;
  toolbar?: React.ReactElement;
  body?: React.ReactElement;
};

export const PluginScaffold = ({
  title,
  toolbar,
  body,
}: PluginScaffoldPropTypes) => {
  return (
    <Flex flexDir="column" height="100%">
      <Box p={3} bg="gray.900">
        <Stack direction="row" alignItems="center" gap={5}>
          <Stack direction="row" alignItems="center">
            <Text fontWeight="bold" color="white">
              <Text>{title}</Text>
            </Text>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={2}>
            {toolbar}
          </Stack>
        </Stack>
      </Box>
      <Flex width="100%" height="100%">
        {body}
      </Flex>
    </Flex>
  );
};
