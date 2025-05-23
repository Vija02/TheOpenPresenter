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
  OverlayToggle,
  OverlayToggleComponentProps,
} from "@repo/ui";
import { FaChevronRight, FaTriangleExclamation } from "react-icons/fa6";

const getStringFromUA = (ua: AwarenessUserData["userAgentInfo"]) => {
  return `${ua.browser.name} / ${ua.os.name}`;
};

export const RendererWarning = () => {
  const { awarenessData } = useAwareness();

  const allErrors = awarenessData.map((x) => x.user?.errors ?? []).flat();

  if (allErrors.length === 0) {
    return null;
  }

  return (
    <OverlayToggle
      toggler={({ onToggle }) => (
        <div
          className="stack-row p-2 justify-center desktop:justify-between cursor-pointer bg-fill-warning text-fill-warning-fg w-full"
          onClick={onToggle}
        >
          <div className="stack-row">
            <FaTriangleExclamation />
            <p className="font-bold">
              {allErrors.length}{" "}
              <span className="hidden desktop:inline">Warning</span>
            </p>
          </div>
          <FaChevronRight className="hidden desktop:block" />
        </div>
      )}
    >
      <RendererWarningModal />
    </OverlayToggle>
  );
};

export type SidebarAddSceneModalPropTypes =
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

const RendererWarningModal = ({
  isOpen,
  onToggle,
  ...props
}: SidebarAddSceneModalPropTypes) => {
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
              <div key={errorCode} className="stack-col items-start">
                <div>
                  <div className="stack-row">
                    <FaTriangleExclamation className="text-fill-warning" />
                    <p className="font-bold text-md">{errorData.title}</p>
                  </div>
                  <p>{errorData.description}</p>
                </div>
                <div>
                  <p className="font-bold">Screens affected:</p>
                  <ul className="list-disc list-inside">
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
                  <div>
                    <p className="font-bold">Steps to resolve:</p>
                    <p className="text-orange-500">{errorData.action}</p>
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
