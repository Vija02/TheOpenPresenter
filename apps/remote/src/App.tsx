import { Box } from "@chakra-ui/react";
import { useSnapshot } from "valtio";

import MainBody from "./MainBody";
import Sidebar from "./containers/Sidebar";
import { mainState } from "./yjs";

function App() {
  const data = useSnapshot(mainState);

  return (
    <div>
      {!!data.data && (
        <Box
          display="flex"
          position="relative"
          height="100vh"
          overflow="hidden"
        >
          <Sidebar />
          <MainBody />
        </Box>
      )}
    </div>
  );
}

export default App;
