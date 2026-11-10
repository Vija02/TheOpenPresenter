import { useCallback, useEffect, useState } from "react";

import { type ConnectionSummary, api, listen } from "../bridge/ipc";
import { Organizations } from "./Organizations";

export function Account() {
  const [current, setCurrent] = useState<ConnectionSummary | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api
      .connection()
      .then(setCurrent)
      .catch((err) => setProblem(String(err)));
  }, []);

  useEffect(refresh, [refresh]);
  useEffect(() => listen<ConnectionSummary>("app:switched", setCurrent), []);

  return (
    <section className="panel-body">
      <Organizations
        online={current?.location === "remote"}
        problem={problem}
        onSwitched={refresh}
        onError={setProblem}
      />
    </section>
  );
}
