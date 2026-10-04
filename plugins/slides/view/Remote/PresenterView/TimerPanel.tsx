import { Button } from "@repo/ui";
import { useEffect, useRef, useState } from "react";
import { MdPause, MdPlayArrow, MdRestartAlt } from "react-icons/md";

const pad = (value: number) => String(value).padStart(2, "0");

const formatElapsed = (elapsedMs: number) => {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
};

export const TimerPanel = () => {
  const [running, setRunning] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);
  const anchor = useRef({ at: Date.now(), base: 0 });

  useEffect(() => {
    if (!running) return;
    const tick = () =>
      setElapsedMs(anchor.current.base + (Date.now() - anchor.current.at));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const toggle = () => {
    if (running) {
      anchor.current = {
        at: anchor.current.at,
        base: anchor.current.base + (Date.now() - anchor.current.at),
      };
      setRunning(false);
    } else {
      anchor.current = { at: Date.now(), base: anchor.current.base };
      setRunning(true);
    }
  };

  const reset = () => {
    anchor.current = { at: Date.now(), base: 0 };
    setElapsedMs(0);
    setRunning(true);
  };

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-stroke px-4 py-3">
      <span className="font-mono text-3xl tabular-nums tracking-tight text-primary sm:text-4xl">
        {formatElapsed(elapsedMs)}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          title={running ? "Pause timer" : "Start timer"}
          aria-label={running ? "Pause timer" : "Start timer"}
          onClick={toggle}
        >
          {running ? <MdPause /> : <MdPlayArrow />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          title="Reset timer"
          aria-label="Reset timer"
          onClick={reset}
        >
          <MdRestartAlt />
        </Button>
      </div>
    </div>
  );
};
