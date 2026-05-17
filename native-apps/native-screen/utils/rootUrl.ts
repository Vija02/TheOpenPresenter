import AsyncStorage from "@react-native-async-storage/async-storage"

const ROOT_URL_KEY = "activeRootUrl"
const AUTO_LOGIN_KEY = "autoLoginEnabled"

// In-memory cache for synchronous access
let cachedRootUrl: string | null = null
let cachedAutoLogin: boolean = false

// Default URL from environment
const DEFAULT_ROOT_URL = process.env.EXPO_PUBLIC_ROOT_URL || ""

/**
 * Get the active root URL (synchronous, uses cache)
 * Falls back to EXPO_PUBLIC_ROOT_URL if not set
 */
export const getRootUrl = (): string => {
	return cachedRootUrl ?? DEFAULT_ROOT_URL
}

/**
 * Set the active root URL and persist it
 */
export const setRootUrl = async (url: string): Promise<void> => {
	cachedRootUrl = url
	await AsyncStorage.setItem(ROOT_URL_KEY, url)
}

/**
 * Clear the stored root URL (called on logout)
 */
export const clearRootUrl = async (): Promise<void> => {
	cachedRootUrl = null
	await AsyncStorage.removeItem(ROOT_URL_KEY)
}

/**
 * Initialize the root URL from storage (call on app start)
 */
export const initRootUrl = async (): Promise<string> => {
	const stored = await AsyncStorage.getItem(ROOT_URL_KEY)
	cachedRootUrl = stored
	return stored ?? DEFAULT_ROOT_URL
}

/**
 * Check if using a custom URL (different from default)
 */
export const isCustomUrl = (): boolean => {
	return cachedRootUrl !== null && cachedRootUrl !== DEFAULT_ROOT_URL
}

/**
 * Check if auto-login mode is enabled (synchronous, uses cache)
 */
export const isAutoLogin = (): boolean => {
	return cachedAutoLogin
}

/**
 * Set auto-login mode and persist it
 */
export const setAutoLogin = async (enabled: boolean): Promise<void> => {
	cachedAutoLogin = enabled
	await AsyncStorage.setItem(AUTO_LOGIN_KEY, enabled ? "1" : "0")
}

/**
 * Clear auto-login mode (called on logout)
 */
export const clearAutoLogin = async (): Promise<void> => {
	cachedAutoLogin = false
	await AsyncStorage.removeItem(AUTO_LOGIN_KEY)
}

/**
 * Initialize auto-login from storage (call on app start)
 */
export const initAutoLogin = async (): Promise<boolean> => {
	const stored = await AsyncStorage.getItem(AUTO_LOGIN_KEY)
	cachedAutoLogin = stored === "1"
	return cachedAutoLogin
}
