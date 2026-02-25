import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import { SimpleURQLProvider } from "@/urql";
import { useOrganizationDashboardHostProjectsQuery } from "@repo/graphql";
import {
  Button,
  Link,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui";
import { createContext, useContext, useMemo, useState } from "react";
import { FaInfoCircle } from "react-icons/fa";
import { MdCoPresent } from "react-icons/md";

type OrganizationActiveDevice = {
  irohEndpointId: string;
  activeProjectIds?: (string | null)[] | null;
};

type HostProjectsProps = {
  organizationActiveDevices: OrganizationActiveDevice[];
};

type HostProjectsContextType = {
  registerDevice: (deviceId: string, hasProjects: boolean) => void;
};

const HostProjectsContext = createContext<HostProjectsContextType>({
  registerDevice: () => {},
});

export const HostProjects = ({
  organizationActiveDevices,
}: HostProjectsProps) => {
  const slug = useOrganizationSlug();
  const [deviceProjectStatus, setDeviceProjectStatus] = useState<
    Record<string, boolean>
  >({});

  const devicesWithProjects = organizationActiveDevices.filter(
    (device) =>
      device.activeProjectIds &&
      device.activeProjectIds.filter((id) => id !== null).length > 0,
  );

  const registerDevice = (deviceId: string, hasProjects: boolean) => {
    setDeviceProjectStatus((prev) => {
      if (prev[deviceId] === hasProjects) return prev;
      return { ...prev, [deviceId]: hasProjects };
    });
  };

  const contextValue = useMemo(() => ({ registerDevice }), []);

  const hasAnyProjects = Object.values(deviceProjectStatus).some(
    (hasProjects) => hasProjects,
  );

  if (devicesWithProjects.length === 0) {
    return null;
  }

  return (
    <HostProjectsContext.Provider value={contextValue}>
      {hasAnyProjects && (
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-lg font-semibold">Host Projects</h2>
          <Tooltip>
            <TooltipTrigger>
              <FaInfoCircle className="text-gray-400 hover:text-gray-600 cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <p></p>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
      {devicesWithProjects.map((device) => (
        <SimpleURQLProvider
          key={device.irohEndpointId}
          headers={{
            "x-organization-slug": slug,
            "x-iroh-endpoint-id": device.irohEndpointId,
          }}
        >
          <HostProjectsDevice device={device} />
        </SimpleURQLProvider>
      ))}
      {hasAnyProjects && <hr className="border-gray-200 my-4" />}
    </HostProjectsContext.Provider>
  );
};

type HostProjectsDeviceProps = {
  device: OrganizationActiveDevice;
};

const HostProjectsDevice = ({ device }: HostProjectsDeviceProps) => {
  const slug = useOrganizationSlug();
  const { registerDevice } = useContext(HostProjectsContext);

  const [{ data }] = useOrganizationDashboardHostProjectsQuery({
    variables: { projectIds: device.activeProjectIds },
  });

  const hasProjects = (data?.projects?.nodes.length ?? 0) > 0;

  // Register this device's project status with the parent
  useMemo(() => {
    registerDevice(device.irohEndpointId, hasProjects);
  }, [device.irohEndpointId, hasProjects, registerDevice]);

  if (!hasProjects) {
    return null;
  }

  return (
    <div className="stack-col items-center flex-wrap gap-0">
      {data?.projects?.nodes.map((project) => {
        const projectSlug = project.slug;
        const orgSlug = project.organization?.slug;

        return (
          <div
            key={`${device.irohEndpointId}-${project.id}`}
            className="project--project-card group"
            role="group"
          >
            <div className="flex items-center gap-2 justify-between sm:justify-start">
              <Link
                href={
                  projectSlug && orgSlug
                    ? `/app/${orgSlug}/${projectSlug}?pOrg=${encodeURIComponent(slug)}&pEndpoint=${encodeURIComponent(device.irohEndpointId)}`
                    : "#"
                }
                className="project--project-card-main-link"
              >
                <p className="text-sm">
                  {project.name !== ""
                    ? project.name
                    : projectSlug || project.id}
                </p>
                <p className="text-xs text-tertiary font-mono">
                  {device.irohEndpointId}
                </p>
              </Link>
              <div className="flex">
                {projectSlug && orgSlug && (
                  <Link
                    href={`/render/${orgSlug}/${projectSlug}?pOrg=${encodeURIComponent(slug)}&pEndpoint=${encodeURIComponent(device.irohEndpointId)}`}
                    isExternal
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      role="button"
                      className="text-tertiary hover:bg-blue-100 hover:text-accent opacity-100 md:opacity-0 group-hover:opacity-100"
                    >
                      <MdCoPresent />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
