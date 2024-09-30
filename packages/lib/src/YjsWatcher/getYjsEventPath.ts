import { YEvent } from "yjs";

export const getYjsEventPath = (event: YEvent<any>) => {
  const path = event.path.map((x) => x.toString());
  const temp = [];

  if ("keysChanged" in event) {
    const keys = Array.from(event.keysChanged as Set<any>);
    temp.push(...keys.map((key) => path.concat(key).join("__")));
  }
  if (event.changes.delta.length > 0) {
    const newArrayLength = event.target.length;

    // The delta can be quite complicated, especially when we account for transaction
    // Thankfully, we can work through it step by step
    // Documentation: https://docs.yjs.dev/api/delta-format
    // We use a few temporary vars to handle this logic
    let pushed = 0;
    let trackedIndex = 0;
    let sameIndex: number[] = [];
    event.changes.delta.forEach((delta) => {
      if (delta.retain) {
        if (pushed === 0) {
          sameIndex.push(
            ...Array.from(new Array(delta.retain)).map(
              (_, i) => trackedIndex + i,
            ),
          );
        }
        trackedIndex += delta.retain;
      } else if (delta.insert) {
        pushed += delta.insert.length;
        trackedIndex += delta.insert.length;
      } else if (delta.delete) {
        pushed -= delta.delete;
      }
    });

    // Add the remaining indexes if available
    if (pushed === 0 && newArrayLength > trackedIndex) {
      sameIndex.push(
        ...Array.from(new Array(newArrayLength - trackedIndex)).map(
          (_, i) => trackedIndex + i,
        ),
      );
    }

    const updatedIndex = Array.from(new Array(newArrayLength))
      .map((_, i) => i)
      .filter((x) => !sameIndex.includes(x));

    temp.push(
      ...updatedIndex.map((key) => path.concat(key.toString()).join("__")),
    );
  }

  return temp;
};
