import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";
import { BiSolidErrorAlt } from "react-icons/bi";
import { VscSync } from "react-icons/vsc";
import type { CombinedError } from "urql";

type ErrorVariant = "warning" | "destructive";

interface ErrorConfig {
  title: string;
  description: ReactNode;
  variant: ErrorVariant;
  action?: ReactNode;
}

interface ErrorDisplayProps extends ErrorConfig {
  children?: ReactNode;
}

function ErrorDisplay({
  title,
  description,
  variant,
  action,
  children,
}: ErrorDisplayProps) {
  const iconColor =
    variant === "warning" ? "text-fill-warning" : "text-fill-destructive";

  return (
    <div className="stack-col mt-[15vh] text-center p-3">
      <BiSolidErrorAlt className={`size-16 ${iconColor}`} />
      <h1 className="text-3xl font-medium">{title}</h1>
      <p className="text-secondary">{description}</p>
      <div className="pb-1" />
      {action}
      {children}
    </div>
  );
}

function RefreshButton() {
  return (
    <Button onClick={() => window.location.reload()}>
      <VscSync />
      Refresh page
    </Button>
  );
}

const ERROR_CONFIGS: Record<string, ErrorConfig> = {
  EBADCSRFTOKEN: {
    title: "Invalid CSRF token",
    description:
      "Our security protections have failed to authenticate your request; to solve this you need to refresh the page:",
    variant: "warning",
    action: <RefreshButton />,
  },
  EPROXYUNREACHABLE: {
    title: "Unable to reach remote machine",
    description:
      "We weren't able to reach your destination machine. The machine might be offline or temporarily unreachable. Please try again",
    variant: "warning",
    action: <RefreshButton />,
  },
  EPROXYUNKNOWN: {
    title: "Unable to find remote machine",
    description:
      "We weren't able to find the machine you requested. Is this an old link? Try to open it from your project page",
    variant: "warning",
    action: (
      <Button asChild>
        <a href="/o" className="no-underline">
          Back to projects
        </a>
      </Button>
    ),
  },
};

export interface ErrorAlertProps {
  error: CombinedError | Error;
}

function extractErrorCode(error: CombinedError | Error): string | undefined {
  const networkErrorCode = (error as any)?.networkError?.result?.errors?.[0]
    ?.code;
  if (networkErrorCode) {
    return networkErrorCode;
  }

  const graphqlErrorCode = (
    (error as CombinedError)?.graphQLErrors?.[0]?.originalError as any
  )?.code;
  if (typeof graphqlErrorCode === "string") {
    return graphqlErrorCode;
  }

  return undefined;
}

export function ErrorAlert({ error }: ErrorAlertProps) {
  const code = extractErrorCode(error);

  const knownError = code ? ERROR_CONFIGS[code] : undefined;

  if (knownError) {
    return <ErrorDisplay {...knownError} />;
  }

  return (
    <ErrorDisplay
      title="Unexpected error occurred"
      description={
        <>
          We're really sorry, an unexpected error occurred. Please try again or{" "}
          <a href="/">return to the homepage</a>.
        </>
      }
      variant="destructive"
    >
      {!!error && (
        <Alert
          variant="destructive"
          title={error.name ?? "Error"}
          className="max-w-2xl"
        >
          {error?.message}
        </Alert>
      )}
    </ErrorDisplay>
  );
}
