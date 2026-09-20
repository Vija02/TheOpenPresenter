import type { FeedDataProvider } from "./feedDataTypes";

/** Feed data providers, keyed by plugin name. A plugin's bundle registers at import time */
const providers = new Map<string, FeedDataProvider>();

export const registerFeedDataProvider = (
  pluginName: string,
  provider: FeedDataProvider,
) => {
  providers.set(pluginName, provider);
};

export const getFeedDataProvider = (
  pluginName: string | null | undefined,
): FeedDataProvider | null =>
  pluginName ? (providers.get(pluginName) ?? null) : null;
