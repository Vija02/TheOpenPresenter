import { Box, Button, Divider, Heading, Text } from "@chakra-ui/react";
import type { Scene } from "@repo/base-plugin";
import { sortBy } from "lodash";
import { typeidUnboxed } from "typeid-js";
import { useLocation } from "wouter";

import { mainState, useData } from "./yjs";

const Sidebar = () => {
  const data = useData();
  const [location, navigate] = useLocation();

  const onAdd = () => {
    mainState.data[typeidUnboxed("scene")] = {
      name: "MWL",
      order:
        (Math.max(0, ...Object.values(data.data).map((x) => x.order)) ?? 0) + 1,
      type: "scene",
      children: {
        [typeidUnboxed("plugin")]: {
          plugin: "myworshiplist",
          order: 1,
          pluginData: { type: "unselected" },
        },
      },
    } as Scene;
  };

  return (
    <Box bg="gray.100">
      <Heading fontSize="lg" mb={3} p={2}>
        TheOpenPresenter Remote
      </Heading>
      <Divider />
      {sortBy(Object.entries(data.data), ([, value]) => value.order).map(
        ([id, value]) => (
          <Box
            key={id}
            onClick={() => {
              navigate(`/${id}`);
            }}
            cursor="pointer"
            px={2}
            _hover={{ bg: "gray.300" }}
            bg={location.includes(id) ? "gray.300" : "transparent"}
          >
            <Text fontWeight="bold">
              {value.name}
              <Text as="i" color="gray.800" fontWeight="normal">
                ({value.type})
              </Text>
            </Text>
          </Box>
        ),
      )}
      <Button onClick={onAdd}>+</Button>
    </Box>
  );
};
export default Sidebar;
