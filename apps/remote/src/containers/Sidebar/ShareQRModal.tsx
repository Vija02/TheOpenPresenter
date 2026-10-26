import { desktop } from "@repo/desktop-bridge";
import {
  useShareProjectCloudQuery,
  useUpdateProjectMutation,
} from "@repo/graphql";
import { usePluginMetaData } from "@repo/shared";
import {
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  useOverlayToggle,
} from "@repo/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import { toast } from "react-toastify";
import { useSearch } from "wouter";

const ShareQRModal = () => {
  const { isOpen, onToggle } = useOverlayToggle();
  const { project, orgSlug, projectSlug, refetch } = usePluginMetaData();
  const search = useSearch();
  const [localIp, setLocalIp] = useState<string | null>(null);
  const [cloudReachable, setCloudReachable] = useState<boolean | null>(null);
  const [chosen, setChosen] = useState<"cloud" | "local" | null>(null);

  const [{ data: cloudData }] = useShareProjectCloudQuery({
    variables: { orgSlug, projectSlug },
    pause: !isOpen,
  });
  const cloudConnection =
    cloudData?.organizationBySlug?.cloudConnections.nodes[0] ?? null;
  const synced =
    !!cloudData?.organizationBySlug?.projects.nodes[0]?.cloudConnectionId;
  const cloudHost =
    synced && cloudConnection?.targetOrganizationSlug
      ? cloudConnection.host
      : null;

  const [{ fetching: loading }, updateProject] = useUpdateProjectMutation();

  const handlePublicToggle = useCallback(
    async (checked: boolean) => {
      try {
        await updateProject({
          id: project?.id,
          isPublic: checked,
        });
        refetch();
      } catch (e: any) {
        toast.error(
          "Failed to update public status: " + (e?.message ?? String(e)),
        );
      }
    },
    [project?.id, refetch, updateProject],
  );

  useEffect(() => {
    if (!isOpen) return;
    desktop.localIp().then(setLocalIp);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !cloudHost) return;
    setCloudReachable(null);
    desktop.canReach(cloudHost).then(setCloudReachable);
  }, [isOpen, cloudHost]);

  // The cloud link works from anywhere, so it is the default whenever the
  // cloud answers. The local one only works on the same network.
  const cloudLink =
    !!cloudHost &&
    (chosen === "cloud" || (chosen === null && cloudReachable === true));

  const shareUrl = useMemo(() => {
    if (cloudLink && cloudHost && cloudConnection?.targetOrganizationSlug) {
      const baseUrl = `${cloudHost.replace(/\/+$/, "")}/app/${cloudConnection.targetOrganizationSlug}/${projectSlug}`;
      return search ? `${baseUrl}?${search}` : baseUrl;
    }

    let origin = window.location.origin;

    if (localIp) {
      const url = new URL(origin);
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        url.hostname = localIp;
        origin = url.origin;
      }
    }

    const baseUrl = `${origin}/app/${orgSlug}/${projectSlug}`;
    return search ? `${baseUrl}?${search}` : baseUrl;
  }, [
    orgSlug,
    projectSlug,
    search,
    localIp,
    cloudLink,
    cloudHost,
    cloudConnection?.targetOrganizationSlug,
  ]);

  return (
    <Dialog open={isOpen ?? false} onOpenChange={onToggle ?? (() => {})}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Share Project</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="center flex-col items-center gap-4 my-1">
            <p className="text-sm text-secondary">
              Scan this QR code to open the project on another device
            </p>
            <div className="w-full bg-white p-4 rounded-md">
              <QRCode
                className="h-auto max-w-full w-full max-h-[256px]"
                value={shareUrl}
              />
            </div>
            {desktop.isDesktop && (
              <p className="text-xs text-muted break-all text-center">
                {shareUrl}
              </p>
            )}
            <div className="flex items-center justify-center gap-2 w-full">
              <Checkbox
                id="isPublic"
                checked={project?.isPublic ?? false}
                onCheckedChange={handlePublicToggle}
                disabled={loading}
              />
              <Label htmlFor="isPublic" className="text-sm cursor-pointer">
                Make project public
              </Label>
            </div>
          </div>
        </DialogBody>
        <DialogFooter className="justify-between">
          {cloudHost ? (
            <Button
              variant="ghost"
              size="xs"
              className="text-secondary self-center"
              onClick={() => setChosen(cloudLink ? "local" : "cloud")}
            >
              {cloudLink
                ? "Use local network link"
                : cloudReachable === false
                  ? "Cloud unreachable. Use cloud link anyway"
                  : "Use cloud link"}
            </Button>
          ) : (
            <span />
          )}
          <Button variant="outline" onClick={onToggle}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShareQRModal;
