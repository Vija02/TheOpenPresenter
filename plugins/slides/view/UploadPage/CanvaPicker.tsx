import { Button, LoadingInline } from "@repo/ui";
import { useEffect, useState } from "react";

type Connection = { id: string; displayName: string | null };
type Design = { id: string; title: string; thumbnailUrl: string | null };

export const CanvaPicker = ({
  token,
  uploaderName,
  send,
}: {
  token: string;
  uploaderName: string;
  send: (run: () => Promise<Response>) => Promise<boolean>;
}) => {
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [designs, setDesigns] = useState<Design[] | null>(null);

  const loadConnections = async () => {
    const res = await fetch(`/plugin/slides/canva-connection/${token}`);
    if (!res.ok) return;
    const body = await res.json();
    setConnections(body.connections ?? []);
  };

  useEffect(() => {
    void loadConnections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const connectionId = connections?.[0]?.id;

  useEffect(() => {
    if (!connectionId) return;

    void (async () => {
      const res = await fetch(
        `/plugin/slides/canva-designs/${token}?connectionId=${connectionId}`,
      );
      if (!res.ok) return;
      const body = await res.json();
      setDesigns(body.items ?? []);
    })();
  }, [connectionId, token]);

  if (connections === null) return <LoadingInline />;

  if (connections.length === 0) {
    return (
      <div className="flex flex-col gap-2 p-4 rounded-lg border border-stroke">
        <span className="text-sm text-secondary">
          Connect your Canva account to pick a design.
        </span>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            window.open(
              `/plugin/slides/canva/authorize-public?token=${token}`,
              "canva-connect",
              "width=600,height=800",
            );
            const onFocus = () => {
              void loadConnections();
              window.removeEventListener("focus", onFocus);
            };
            window.addEventListener("focus", onFocus);
          }}
        >
          Connect Canva
        </Button>
      </div>
    );
  }

  if (designs === null) return <LoadingInline />;

  if (designs.length === 0) {
    return (
      <span className="text-sm text-secondary">
        No designs found in your Canva account.
      </span>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {designs.map((design) => (
        <button
          key={design.id}
          type="button"
          className="flex flex-col gap-1 p-2 rounded-lg border border-stroke hover:bg-surface-secondary text-left"
          onClick={() =>
            send(() =>
              fetch(`/plugin/slides/canva-import/${token}`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-top-csrf-protection": "1",
                },
                body: JSON.stringify({
                  connectionId,
                  designId: design.id,
                  title: design.title,
                  uploaderName: uploaderName || undefined,
                }),
              }),
            )
          }
        >
          {design.thumbnailUrl && (
            <img
              src={design.thumbnailUrl}
              alt=""
              className="w-full aspect-[4/3] object-cover rounded"
            />
          )}
          <span className="text-xs truncate">{design.title}</span>
        </button>
      ))}
    </div>
  );
};
