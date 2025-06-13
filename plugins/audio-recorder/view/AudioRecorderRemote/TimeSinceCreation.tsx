import { addSeconds, formatDuration, intervalToDuration } from "date-fns";
import { useMemo, useState } from "react";
import { useElapsedTime } from "use-elapsed-time";

export const TimeSinceCreation = ({
  startedAt,
}: {
  startedAt: string | Date;
}) => {
  const { elapsedTime } = useElapsedTime({
    updateInterval: 1,
    isPlaying: true,
  });

  const [now] = useState(new Date());

  const duration = useMemo(
    () =>
      intervalToDuration({
        start: startedAt,
        end: addSeconds(now, elapsedTime),
      }),
    [elapsedTime, now, startedAt],
  );

  return (
    <>
      <p>{formatDuration(duration)}</p>
    </>
  );
};
