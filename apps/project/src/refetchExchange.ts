import { Exchange, Operation, makeOperation, mapExchange } from "urql";

/** Dispatch on `window` to re-run every mounted query from the network. */
export const REFETCH_EVENT = "top:refetch";

export const refetchExchange: Exchange = (input) => {
  const active = new Map<number, Operation>();

  window.addEventListener(REFETCH_EVENT, () => {
    for (const operation of active.values()) {
      input.client.reexecuteOperation(
        makeOperation("query", operation, {
          ...operation.context,
          requestPolicy: "network-only",
        }),
      );
    }
  });

  return mapExchange({
    onOperation(operation) {
      if (operation.kind === "query") active.set(operation.key, operation);
      if (operation.kind === "teardown") active.delete(operation.key);
    },
  })(input);
};
