import { Box } from "@chakra-ui/react";
import ReactJson from "react-json-view";
import { useSnapshot } from "valtio";

import { Body } from "./Body";
import { mainState } from "./yjs";

function App() {
  const data = useSnapshot(mainState);

  return (
    <div>
      {!!data.data && (
        <Box w="100vw" h="100vh">
          <Body />
        </Box>
      )}
      <ReactJson src={data} />
    </div>
  );
}

export default App;
