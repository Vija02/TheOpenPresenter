import { getCSRFToken } from "@/lib/getCSRFToken";
import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import {
  Box,
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  ModalProps,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { globalState } from "@repo/lib";
import { logger } from "@repo/observability";
import { OverlayToggleComponentProps } from "@repo/ui";
import NextLink from "next/link";
import { useCallback, useRef, useState } from "react";
import { FaExternalLinkAlt, FaFileImport } from "react-icons/fa";
import { toast } from "react-toastify";

export type ImportProjectModalPropTypes = Omit<
  ModalProps,
  "isOpen" | "onClose" | "children"
> &
  Partial<OverlayToggleComponentProps> & {
    organizationId: string;
  };

const ImportProjectModal = ({
  isOpen,
  onToggle,
  resetData,
  organizationId,
  ...props
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
            "CSRF-Token": getCSRFToken(),
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
    <Modal
      size={{ base: "full", md: "xl" }}
      isOpen={isOpen ?? false}
      onClose={handleClose}
      {...props}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {importedProject
            ? "Project Imported Successfully!"
            : "Import Project"}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {importedProject ? (
            <VStack alignItems="center" spacing={4}>
              <Text fontSize="lg" fontWeight="bold" color="green.600">
                ✅ Import Complete
              </Text>
              <Text textAlign="center">
                Project <strong>"{importedProject.name}"</strong> has been
                successfully imported to your organization.
              </Text>
              <NextLink
                href={`/app/${organizationSlug}/${importedProject.slug}`}
              >
                <Button
                  variant="outline"
                  size="sm"
                  display="flex"
                  gap={2}
                  onClick={handleNavigateToProject}
                  w="100%"
                >
                  <FaExternalLinkAlt />
                  Open
                </Button>
              </NextLink>
            </VStack>
          ) : (
            <VStack alignItems="flex-start" spacing={4}>
              <Text>Select a .top file to import into your organization.</Text>

              <Box w="100%">
                <Button
                  colorScheme="green"
                  size="md"
                  display="flex"
                  gap={2}
                  isLoading={isLoading}
                  onClick={handleImportClick}
                  w="100%"
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
              </Box>

              <Text fontSize="sm" color="gray.600">
                Only .top files are supported for import.
              </Text>
            </VStack>
          )}
        </ModalBody>
        <ModalFooter>
          <Stack direction="row">
            <Button variant="ghost" onClick={handleClose}>
              Close
            </Button>
          </Stack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ImportProjectModal;
