import { useOrganizationSlug } from "@/lib/permissionHooks/organization";
import { SimpleURQLProvider } from "@/urql";
import { useOrganizationDashboardHostProjectsQuery } from "@repo/graphql";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui";
import { createContext, useContext, useMemo, useState } from "react";
import { FaInfoCircle } from "react-icons/fa";

import { ProjectCard } from "./ProjectCard";

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
          <h2 className="text-2xl font-bold">
            Projects from your other devices
          </h2>
          <Tooltip>
            <TooltipTrigger>
              <FaInfoCircle className="text-gray-400 hover:text-gray-600 cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <p>
                These projects are showing here because you have connected them
                to the cloud
              </p>
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

        const linkHref =
          projectSlug && orgSlug
            ? `/app/${orgSlug}/${projectSlug}?pOrg=${encodeURIComponent(slug)}&pEndpoint=${encodeURIComponent(device.irohEndpointId)}`
            : "#";
        const renderHref =
          projectSlug && orgSlug
            ? `/render/${orgSlug}/${projectSlug}?pOrg=${encodeURIComponent(slug)}&pEndpoint=${encodeURIComponent(device.irohEndpointId)}`
            : "#";

        return (
          <ProjectCard
            key={`${device.irohEndpointId}-${project.id}`}
            project={project}
            linkHref={linkHref}
            renderHref={renderHref}
          />
        );
      })}
    </div>
  );
};
