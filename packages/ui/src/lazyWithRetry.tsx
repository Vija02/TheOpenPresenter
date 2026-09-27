import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Component, ComponentType, ReactNode, lazy, useState } from "react";
import { VscSync } from "react-icons/vsc";

type Loader = () => Promise<{ default: ComponentType<any> }>;

// Chrome and Firefox include the failed URL in the message. Safari does not.
const failedModuleUrl = (error: unknown) =>
  String((error as Error | undefined)?.message ?? "").match(
    /https?:\/\/\S+/,
  )?.[0];

// The browser caches a failed dynamic import for the life of the page, so
// importing the same URL again fails without a new request. A query string
// makes it a new module URL.
// More info: https://github.com/whatwg/html/issues/6768
export async function importWithRetry<T>(
  loader: () => Promise<T>,
  maxAttempts = 4,
  baseDelay = 1000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const url = attempt === 1 ? undefined : failedModuleUrl(lastError);
      if (!url) {
        return await loader();
      }
      const bustedUrl = new URL(url);
      bustedUrl.searchParams.set("t", String(Date.now()));
      return await import(/* @vite-ignore */ bustedUrl.href);
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

class ViewErrorBoundary extends Component<
  { onRetry: () => void; children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Report it like an uncaught error so error tracking still sees it
    window.reportError?.(error);
  }

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <div className="stack-col p-3">
        <Alert
          variant="destructive"
          title="Unable to show this view"
          className="max-w-2xl"
        >
          {error.message}
        </Alert>
        <Button
          onClick={() => {
            this.props.onRetry();
            this.setState({ error: null });
          }}
        >
          <VscSync />
          Try again
        </Button>
      </div>
    );
  }
}

// Use it in place of React.lazy for plugin views. It retries a failed chunk
// load, and if that still fails, it shows an error with a retry button in
// place of the view.
export const lazyWithRetry = (loader: Loader) => {
  const createLazy = () => lazy(() => importWithRetry(loader));
  let LazyComponent = createLazy();

  return (props: any) => {
    const [, setAttempt] = useState(0);

    return (
      <ViewErrorBoundary
        onRetry={() => {
          LazyComponent = createLazy();
          setAttempt((x) => x + 1);
        }}
      >
        <LazyComponent {...props} />
      </ViewErrorBoundary>
    );
  };
};
