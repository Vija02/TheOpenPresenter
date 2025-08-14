import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import { appData, globalState } from "@repo/lib";
import { logger } from "@repo/observability";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Link,
  OverlayToggleComponentProps,
} from "@repo/ui";
import { useCallback, useRef, useState } from "react";
import { FaExternalLinkAlt, FaFileImport } from "react-icons/fa";
import { toast } from "react-toastify";
import { Link as WouterLink } from "wouter";

export type ImportProjectModalPropTypes =
  Partial<OverlayToggleComponentProps> & {
    organizationId: string;
  };

const ImportProjectModal = ({
  isOpen,
  onToggle,
  resetData,
  organizationId,
}: ImportProjectModalPropTypes) => {
  const { publish } = globalState.modelDataAccess.usePublishAPIChanges({
    token: "page",
  });
  const organizationSlug = useOrganizationSlug();

  const [isLoading, setIsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importedProject, setImportedProject] = useState<{
    name: string;
    slug: string;
  } | null>(null);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleClose = useCallback(() => {
    setImportedProject(null);
    onToggle?.();
    resetData?.();
  }, [onToggle, resetData]);

  const handleNavigateToProject = useCallback(() => {
    if (importedProject && organizationSlug) {
      window.location.href = `/app/${organizationSlug}/${importedProject.slug}`;
    }
  }, [importedProject, organizationSlug]);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.name.endsWith(".top")) {
        toast.error("Please select a .top file");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("orgId", organizationId);

      try {
        setIsLoading(true);
        const response = await fetch("/projectImport", {
          method: "POST",
          body: formData,
          headers: {
            "CSRF-Token": appData.getCSRFToken(),
          },
        });

        const result = await response.json();

        if (response.ok) {
          setImportedProject({
            name: result.project.name,
            slug: result.project.slug,
          });
          publish();
        } else {
          logger.debug(
            { error: result.error },
            "Failed to import project, response not ok",
          );
          toast.error(result.error || "Failed to import project");
        }
      } catch (error) {
        toast.error("Error importing project");
        logger.debug({ error }, "Error importing project");
        console.error("Import error:", error);
      } finally {
        setIsLoading(false);
      }

      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [organizationId, publish],
  );

  return (
    <Dialog open={isOpen ?? false} onOpenChange={handleClose}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>
            {importedProject
              ? "Project Imported Successfully!"
              : "Import Project"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          {importedProject ? (
            <div className="stack-col gap-4">
              <p className="text-lg font-bold text-green-600">
                ✅ Import Complete
              </p>
              <p className="text-center">
                Project <strong>"{importedProject.name}"</strong> has been
                successfully imported to your organization.
              </p>
              <Link asChild>
                <WouterLink
                  href={`/app/${organizationSlug}/${importedProject.slug}`}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex gap-2 w-full"
                    onClick={handleNavigateToProject}
                  >
                    <FaExternalLinkAlt />
                    Open
                  </Button>
                </WouterLink>
              </Link>
            </div>
          ) : (
            <div className="stack-col items-start gap-4">
              <p>Select a .top file to import into your organization.</p>

              <div className="w-full">
                <Button
                  variant="success"
                  size="default"
                  className="flex gap-2 w-full"
                  isLoading={isLoading}
                  onClick={handleImportClick}
                >
                  <FaFileImport />
                  Choose File to Import
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".top"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
              </div>

              <p className="text-sm text-secondary">
                Only .top files are supported for import.
              </p>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <div className="stack-row">
            <Button variant="ghost" onClick={handleClose}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportProjectModal;
