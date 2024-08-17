import { Grid } from "@chakra-ui/react";
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
    </div>
  );
}

export default App;
