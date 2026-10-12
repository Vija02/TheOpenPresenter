import { LoadingPart } from "@/Loading/LoadingPart";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Component, ComponentType, Suspense, lazy } from "react";
import { VscSync } from "react-icons/vsc";

type Loader = () => Promise<{ default: ComponentType<any> }>;

// Safari doesn't include the URL in the message, so we fall back to the loader
const failedModuleUrl = (error: unknown) =>
  String((error as Error | undefined)?.message ?? "").match(
    /https?:\/\/\S+/,
  )?.[0];

// Browsers cache failed dynamic imports, so we bust it with a query string
// https://github.com/whatwg/html/issues/6768
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

const RELOAD_KEY = "lazyWithRetry:reloadedAt";
const RELOAD_COOLDOWN_MS = 60_000;

// A deploy removes the old hashed chunks, so only a fresh page can load the view.
// We reload at most once per cooldown so a real outage doesn't loop, and never
// offline, where a reload would replace the app with the browser's offline page
const reloadOnce = () => {
  if (!navigator.onLine) {
    return false;
  }
  try {
    const reloadedAt = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - reloadedAt < RELOAD_COOLDOWN_MS) {
      return false;
    }
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
};

export const lazyWithRetry = (loader: Loader) => {
  const LazyComponent = lazy(() =>
    importWithRetry(loader).catch((error) => {
      if (reloadOnce()) {
        // Keep the loading state until the page reloads
        return new Promise<never>(() => {});
      }
      throw error;
    }),
  );

  return class LazyWithRetry extends Component<any, { error: Error | null }> {
    state = { error: null as Error | null };

    static getDerivedStateFromError(error: Error) {
      return { error };
    }

    componentDidCatch(error: Error) {
      window.reportError?.(error);
    }

    render() {
      const { error } = this.state;
      if (!error) {
        return (
          <Suspense fallback={<LoadingPart />}>
            <LazyComponent {...this.props} />
          </Suspense>
        );
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
          <Button onClick={() => window.location.reload()}>
            <VscSync />
            Reload page
          </Button>
        </div>
      );
    }
  };
};
