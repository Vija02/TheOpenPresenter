import { Grid } from "@chakra-ui/react";
import { useSnapshot } from "valtio";

import MainBody from "./MainBody";
import Sidebar from "./Sidebar";
import { mainState } from "./yjs";

function App() {
  const data = useSnapshot(mainState);

  return (
    <div>
      {!!data.data && (
        <Grid gridTemplateColumns={`200px 1fr`}>
          <Sidebar />
          <MainBody />
        </Grid>
      )}
      <div>{JSON.stringify(data)}</div>
    </div>
  );
}

export default App;
