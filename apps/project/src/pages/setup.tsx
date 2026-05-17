import { Skeleton } from "@repo/ui";
import { EventSourcePlus } from "event-source-plus";
import { useState } from "react";
import QRCode from "react-qr-code";
import { useDisposable } from "use-disposable";

const SetupScreenPage = () => {
  const [qrId, setQRId] = useState<string | null>(null);

  useDisposable(() => {
    const eventSource = new EventSourcePlus("/qr-auth/screen-select/request", {
      retryStrategy: "on-error",
    });
    const controller = eventSource.listen({
      onMessage(ev) {
        try {
          const data = JSON.parse(ev.data);
          if (data.id) {
            setQRId(data.id);
          }
          if (data.done && data.screen && data.loginToken) {
            const { orgSlug, screenSlug } = data.screen;
            if (orgSlug && screenSlug) {
              controller.abort();

              const loginUrl = new URL(
                "/qr-auth/login",
                window.location.origin,
              );
              loginUrl.searchParams.set("token", data.loginToken);
              loginUrl.searchParams.set(
                "next",
                `/render/s/${orgSlug}/${screenSlug}`,
              );
              loginUrl.searchParams.set("persist-session", "1");

              window.location.href = loginUrl.toString();
            }
          }
        } catch (e) {
          // Keep alive
        }
      },
    });

    return [undefined, () => controller.abort()];
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-2">Setup this screen</h1>
        <p className="text-secondary mb-6 text-sm">
          Scan the QR code with your phone to setup this screen.
        </p>
        <div className="flex justify-center">
          {!qrId && (
            <Skeleton className="w-full max-w-[256px] aspect-square bg-gray-200 animate-pulse rounded-sm" />
          )}
          {qrId && (
            <div className="w-full max-w-[256px]">
              <QRCode
                className="h-auto max-w-full w-full"
                value={`${window.location.origin}/qr-auth/screen-select/auth?id=${qrId}`}
              />
              {/* Hidden URL */}
              <span hidden data-testid="qrlogin-auth-url">
                {`${window.location.origin}/qr-auth/screen-select/auth?id=${qrId}`}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SetupScreenPage;
