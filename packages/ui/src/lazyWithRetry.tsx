import { LoadingPart } from "@/Loading/LoadingPart";
import { Button } from "@/components/ui/button";
import { Component, ComponentType, ReactNode, Suspense, lazy } from "react";
import {
  LuRefreshCw,
  LuRotateCcw,
  LuSparkles,
  LuTriangleAlert,
} from "react-icons/lu";

type Loader = () => Promise<{ default: ComponentType<any> }>;

// Safari doesn't include the URL in the message, so we fall back to the loader
const failedModuleUrl = (error: unknown) =>
  String((error as Error | undefined)?.message ?? "").match(
    /https?:\/\/\S+/,
  )?.[0];

/** The file was removed by a deploy, so only a page reload can load it */
export class NewVersionError extends Error {
  constructor(public readonly original: unknown) {
    super("A new version is available. Reload the page to open this.");
    this.name = "NewVersionError";
  }
}

/** Every attempt to load the file failed, eg. a flaky connection */
class LoadError extends Error {
  constructor(public readonly original: unknown) {
    super((original as Error | undefined)?.message ?? String(original));
    this.name = "LoadError";
  }
}

// After a deploy the old file 404s, or the SPA fallback serves HTML in its place.
// Retrying can't fix that, so we skip straight to failing
const isModuleGone = async (url: string) => {
  try {
    const res = await fetch(url, { cache: "no-store" });
    return (
      // S3-style storage answers 403 for a missing file
      res.status === 403 ||
      res.status === 404 ||
      res.status === 410 ||
      // The SPA fallback answers 200. An HTML 5xx is an outage page, so retry
      (res.ok && !!res.headers.get("content-type")?.includes("text/html"))
    );
  } catch {
    // Network error, so a retry might still work
    return false;
  }
};

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
      const url = attempt === 1 ? failedModuleUrl(error) : undefined;
      if (url && (await isModuleGone(url))) {
        throw new NewVersionError(error);
      }
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
// offline, where a reload would replace the app with the browser's offline page.
// The mark lives in history.state, not sessionStorage, because sessionStorage is
// shared by every iframe in the tab and one preview would block the others
const reloadOnce = () => {
  if (!navigator.onLine) {
    return false;
  }
  try {
    const state = history.state ?? {};
    const reloadedAt = Number(state[RELOAD_KEY] ?? 0);
    if (Date.now() - reloadedAt < RELOAD_COOLDOWN_MS) {
      return false;
    }
    history.replaceState({ ...state, [RELOAD_KEY]: Date.now() }, "");
  } catch {
    return false;
  }
  window.location.reload();
  return true;
};

/**
 * Like `importWithRetry`, but reloads the page once if every attempt fails.
 * Only for screens nobody interacts with, like the renderer. Elsewhere we ask
 * the user to reload so they don't lose what they were doing
 */
export const importOrReload = <T,>(loader: () => Promise<T>): Promise<T> =>
  importWithRetry(loader).catch((error) => {
    if (reloadOnce()) {
      // Keep the loading state until the page reloads
      return new Promise<never>(() => {});
    }
    throw error;
  });

const MESSAGES = {
  newVersion: {
    title: "New version available",
    body: "Reload the page to open this.",
  },
  loadFailed: {
    title: "Couldn't load this view",
    body: "Check your connection, then try again.",
  },
  crashed: {
    title: "Something went wrong",
    body: "This view stopped working. Try opening it again.",
  },
};

const ViewError = ({
  kind,
  onRetry,
}: {
  kind: keyof typeof MESSAGES;
  onRetry: () => void;
}) => {
  const isNewVersion = kind === "newVersion";

  return (
    <div className="flex h-full min-h-48 w-full items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div
          className={
            isNewVersion
              ? "flex size-12 items-center justify-center rounded-full bg-accent/10 text-accent"
              : "flex size-12 items-center justify-center rounded-full bg-fill-destructive/10 text-fill-destructive"
          }
        >
          {isNewVersion ? (
            <LuSparkles className="size-6" />
          ) : (
            <LuTriangleAlert className="size-6" />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold">{MESSAGES[kind].title}</h3>
          <p className="text-sm text-secondary">{MESSAGES[kind].body}</p>
        </div>
        {isNewVersion ? (
          <Button size="sm" onClick={() => window.location.reload()}>
            <LuRefreshCw />
            Reload page
          </Button>
        ) : (
          <Button size="sm" onClick={onRetry}>
            <LuRotateCcw />
            Try again
          </Button>
        )}
      </div>
    </div>
  );
};

type LazyWithRetryOptions = {
  /** Reload the page once if loading fails. For screens nobody interacts with */
  autoReload?: boolean;
  /**
   * Show an error card when the loaded view crashes. Turn off when a boundary
   * above should handle it, or on screens the audience sees
   */
  catchCrashes?: boolean;
  /** Shown while loading. A function gets the component's props */
  fallback?: ReactNode | ((props: any) => ReactNode);
};

export const lazyWithRetry = (
  loader: Loader,
  {
    autoReload = false,
    catchCrashes = true,
    fallback = <LoadingPart />,
  }: LazyWithRetryOptions = {},
) => {
  const createLazy = () =>
    lazy(() =>
      (autoReload ? importOrReload(loader) : importWithRetry(loader)).catch(
        (error) => {
          throw error instanceof NewVersionError ? error : new LoadError(error);
        },
      ),
    );
  let LazyComponent = createLazy();

  return class LazyWithRetry extends Component<any, { error: Error | null }> {
    state = { error: null as Error | null };

    static getDerivedStateFromError(error: Error) {
      return { error };
    }

    componentDidCatch(error: Error) {
      // A new version is expected after every deploy, so not worth reporting.
      // Uncaught crashes are rethrown below and reported further up
      if (
        error instanceof LoadError ||
        (catchCrashes && !(error instanceof NewVersionError))
      ) {
        window.reportError?.(error);
      }
    }

    retry = () => {
      // React keeps a failed lazy import, so a retry needs a new one
      if (this.state.error instanceof LoadError) {
        LazyComponent = createLazy();
      }
      this.setState({ error: null });
    };

    render() {
      const { error } = this.state;
      if (!error) {
        return (
          <Suspense
            fallback={
              typeof fallback === "function" ? fallback(this.props) : fallback
            }
          >
            <LazyComponent {...this.props} />
          </Suspense>
        );
      }

      if (error instanceof NewVersionError) {
        return <ViewError kind="newVersion" onRetry={this.retry} />;
      }
      if (error instanceof LoadError) {
        return <ViewError kind="loadFailed" onRetry={this.retry} />;
      }
      if (!catchCrashes) {
        throw error;
      }
      return <ViewError kind="crashed" onRetry={this.retry} />;
    }
  };
};
