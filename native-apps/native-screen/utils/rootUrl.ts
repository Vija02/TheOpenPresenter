import AsyncStorage from "@react-native-async-storage/async-storage"

const ROOT_URL_KEY = "activeRootUrl"

// Default URL from environment
const DEFAULT_ROOT_URL = process.env.EXPO_PUBLIC_ROOT_URL || ""

/**
 * Get the active root URL.
 * The new flow has no URL-switcher UI, so we always use the env default.
 */
export const getRootUrl = (): string => DEFAULT_ROOT_URL

/**
 * Set the active root URL and persist it.
 * Kept for compatibility with `login()` callers that may pass a custom URL.
 */
export const setRootUrl = async (url: string): Promise<void> => {
	await AsyncStorage.setItem(ROOT_URL_KEY, url)
}

/**
 * Clear any stored root URL (called on logout, and also at app start to
 * drop any stale value left over from the old auto-login flow).
 */
export const clearRootUrl = async (): Promise<void> => {
	await AsyncStorage.removeItem(ROOT_URL_KEY)
}

/**
 * Initialize the root URL on app start.
 * Drops any legacy stored override; current builds always honour the env var.
 */
export const initRootUrl = async (): Promise<string> => {
	await AsyncStorage.removeItem(ROOT_URL_KEY)
	return DEFAULT_ROOT_URL
}
