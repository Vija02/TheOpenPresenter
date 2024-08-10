import { Box, Grid } from "@chakra-ui/react";
import ReactJson from "react-json-view";
import { useSnapshot } from "valtio";

import MainBody from "./MainBody";
import Sidebar from "./containers/Sidebar";
import { mainState } from "./yjs";

function App() {
  const data = useSnapshot(mainState);

  return (
    <div>
      {!!data.data && (
        <Grid gridTemplateColumns={`200px 1fr`} width="100vw" height="100vh">
          <Sidebar />
          <MainBody />
        </Grid>
      )}
      <Box w="100%" overflow="auto">
        <ReactJson src={data} />
      </Box>
    </div>
  );
}

export default App;
