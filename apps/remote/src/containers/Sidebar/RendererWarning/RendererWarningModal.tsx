import { AwarenessUserData } from "@repo/base-plugin";
import { useAwareness } from "@repo/shared";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  OverlayToggleComponentProps,
} from "@repo/ui";
import { FaTriangleExclamation } from "react-icons/fa6";

import "./RendererWarningModal.css";

const getStringFromUA = (ua: AwarenessUserData["userAgentInfo"]) => {
  return `${ua.browser.name} / ${ua.os.name}`;
};

export type RendererWarningModalPropTypes =
  Partial<OverlayToggleComponentProps>;

// TODO: Move this to server and allow plugins to register
const errorSettings: Record<
  string,
  { title: string; description: string; action?: string }
> = {
  ERR_AUDIO_AUTOPLAY: {
    title: "Audio not enabled on one or more screens",
    description:
      "Due to browser limitation, you need to interact with your screen to enable audio.",
    action: "Click anywhere on your affected screen.",
  },
};

export const RendererWarningModal = ({
  isOpen,
  onToggle,
  ...props
}: RendererWarningModalPropTypes) => {
  const { awarenessData } = useAwareness();

  const allErrors = awarenessData.map((x) => x.user?.errors ?? []).flat();

  return (
    <Dialog
      open={isOpen ?? false}
      onOpenChange={onToggle ?? (() => {})}
      {...props}
    >
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Warnings</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {allErrors.map((errorCode) => {
            if (!(errorCode in errorSettings)) {
              console.error("Unhandled Error Code: ", errorCode);
              return null;
            }

            const errorData = errorSettings[errorCode]!;

            return (
              <div
                key={errorCode}
                className="rt--renderer-warning-modal--container"
              >
                <div className="rt--renderer-warning-modal--title">
                  <div>
                    <FaTriangleExclamation />
                    <p>{errorData.title}</p>
                  </div>
                  <p>{errorData.description}</p>
                </div>
                <div className="rt--renderer-warning-modal--screen-affected">
                  <p>Screens affected:</p>
                  <ul>
                    {awarenessData
                      .filter((x) => x.user?.errors.includes(errorCode))
                      .map((x) => (
                        <li key={x.user!.id}>
                          {getStringFromUA(x.user!.userAgentInfo)}
                        </li>
                      ))}
                  </ul>
                </div>
                {!!errorData.action && (
                  <div className="rt--renderer-warning-modal--resolve">
                    <p>Steps to resolve:</p>
                    <p>{errorData.action}</p>
                  </div>
                )}
              </div>
            );
          })}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onToggle}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
