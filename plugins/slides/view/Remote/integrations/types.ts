import { ComponentType, ReactNode } from "react";

/** Context passed when an integration import is launched. */
export type IntegrationLaunchContext = {
  /** When set, the produced import replaces this existing import. */
  replaceImportId?: string;
  onComplete?: () => void;
};

export type IntegrationController = {
  isLoading: boolean;
  open: (context?: IntegrationLaunchContext) => void;
};

export type IntegrationControllerProps = {
  children: (controller: IntegrationController) => React.ReactElement;
};

export type SlideIntegration = {
  id: string;
  name: string;
  icon: ReactNode;
  Controller: ComponentType<IntegrationControllerProps>;
};
