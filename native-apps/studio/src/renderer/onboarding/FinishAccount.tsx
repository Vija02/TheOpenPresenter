import { Button } from "@repo/ui";
import { useEffect } from "react";

import { api } from "../bridge/ipc";
import { Logo } from "../shared/Logo";

const POLL_MS = 3000;

export function FinishAccount({
  rootUrl,
  onDone,
}: {
  rootUrl: string;
  onDone: () => void;
}) {
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      const status = await api.cloudOnboarding(rootUrl).catch(() => null);
      if (stopped) return;
      if (status?.completed) {
        onDone();
        return;
      }
      timer = setTimeout(() => void poll(), POLL_MS);
    };

    timer = setTimeout(() => void poll(), POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [rootUrl, onDone]);

  return (
    <section className="onboarding">
      <Logo />
      <h2>Finish setting up your account</h2>
      <p className="muted">
        Your account is ready. Finish onboarding on the website to set up your
        organization, and this window will continue on its own.
      </p>
      <Button
        variant="link"
        onClick={() => api.openExternal(`${rootUrl}/onboarding`)}
      >
        Open the website
      </Button>
    </section>
  );
}
