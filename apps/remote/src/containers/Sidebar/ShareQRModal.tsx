import { useUpdateProjectMutation } from "@repo/graphql";
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
import { core } from "@tauri-apps/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import { useSearch } from "wouter";

const ShareQRModal = () => {
  const { isOpen, onToggle } = useOverlayToggle();
  const { project, orgSlug, projectSlug, refetch } = usePluginMetaData();
  const search = useSearch();
  const [localIp, setLocalIp] = useState<string | null>(null);

  const [{ fetching: loading }, updateProject] = useUpdateProjectMutation();

  const handlePublicToggle = useCallback(
    (checked: boolean) => {
      updateProject({
        id: project?.id,
        isPublic: checked,
      }).then(() => {
        refetch();
      });
    },
    [project?.id, refetch, updateProject],
  );

  useEffect(() => {
    if (window.__TAURI_INTERNALS__ && isOpen) {
      core.invoke<string | null>("get_local_ip").then((ip) => {
        setLocalIp(ip);
      });
    }
  }, [isOpen]);

  const shareUrl = useMemo(() => {
    let origin = window.location.origin;

    // If running in Tauri and localhost, replace with local IP
    if (window.__TAURI_INTERNALS__ && localIp) {
      const url = new URL(origin);
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        url.hostname = localIp;
        origin = url.origin;
      }
    }

    const baseUrl = `${origin}/remote/${orgSlug}/${projectSlug}`;
    return search ? `${baseUrl}?${search}` : baseUrl;
  }, [orgSlug, projectSlug, search, localIp]);

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
            {window.__TAURI_INTERNALS__ && (
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
        <DialogFooter>
          <Button variant="outline" onClick={onToggle}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShareQRModal;
