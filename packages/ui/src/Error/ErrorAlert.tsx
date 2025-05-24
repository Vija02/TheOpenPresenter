import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BiSolidErrorAlt } from "react-icons/bi";
import { VscSync } from "react-icons/vsc";

export interface ErrorAlertProps {
  error: Error;
}

export function ErrorAlert({ error }: ErrorAlertProps) {
  const code: string | undefined = (error as any)?.networkError?.result
    ?.errors?.[0]?.code;
  if (code === "EBADCSRFTOKEN") {
    return (
      <div className="stack-col mt-[15vh] text-center">
        <BiSolidErrorAlt className="size-16 text-fill-warning" />
        <h1 className="text-3xl font-medium">Invalid CSRF token</h1>
        <p className="text-secondary">
          Our security protections have failed to authenticate your request; to
          solve this you need to refresh the page:
        </p>
        <div className="pb-3" />
        <Button onClick={() => window.location.reload()}>
          <VscSync />
          Refresh page
        </Button>
      </div>
    );
  }

  return (
    <div className="stack-col mt-[15vh] text-center">
      <BiSolidErrorAlt className="size-16 text-fill-destructive" />
      <h1 className="text-3xl font-medium">Unexpected error occurred</h1>
      <p className="text-secondary">
        We're really sorry, an unexpected error occurred. Please try again or{" "}
        <a href="/">return to the homepage</a>.
      </p>
      <div className="pb-3" />
      {!!error && (
        <Alert
          variant="destructive"
          title={error.name ?? "Error"}
          className="max-w-2xl"
        >
          {error?.message}
        </Alert>
      )}
    </div>
  );
}
