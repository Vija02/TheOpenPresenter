import { Box } from "@chakra-ui/react";
import { useSnapshot } from "valtio";

import { Body } from "./Body";
import { mainState } from "./yjs";

function App() {
  const data = useSnapshot(mainState);

  // TODO: Loading

  return (
    <div>
      {!!data.data && (
        <Box w="100vw" h="100vh">
          <Body />
        </Box>
      )}
    </div>
  );
}

export default App;
