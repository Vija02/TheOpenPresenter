import { Box, Flex, Stack, Text } from "@chakra-ui/react";

type PluginScaffoldPropTypes = {
  title: string;
  toolbar?: React.ReactElement;
  postToolbar?: React.ReactElement;
  body?: React.ReactElement;
};

export const PluginScaffold = ({
  title,
  toolbar,
  postToolbar,
  body,
}: PluginScaffoldPropTypes) => {
  return (
    <Flex flexDir="column" height="100%">
      <Box p={3} bg="gray.900">
        <Stack direction="row" alignItems="center" gap={5} flexWrap="wrap">
          <Stack direction="row" alignItems="center">
            <Text fontWeight="bold" color="white">
              <Text>{title}</Text>
            </Text>
          </Stack>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={2}
            flex={1}
            flexWrap="wrap"
          >
            <Stack
              direction="row"
              alignItems="center"
              spacing={2}
              flexWrap="wrap"
            >
              {toolbar}
            </Stack>
            <Stack
              direction="row"
              alignItems="center"
              spacing={2}
              flexWrap="wrap"
            >
              {postToolbar}
            </Stack>
          </Stack>
        </Stack>
      </Box>
      <Flex width="100%" height="100%">
        {body}
      </Flex>
    </Flex>
  );
};
