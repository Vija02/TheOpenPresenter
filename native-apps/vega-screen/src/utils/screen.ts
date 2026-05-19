import AsyncStorage from '@amazon-devices/react-native-async-storage__async-storage';

const SCREEN_KEY = 'screen';

export type Screen = {
  orgSlug: string;
  screenSlug: string;
};

let cachedScreen: Screen | null = null;

/**
 * Get the persisted screen identity (synchronous, uses cache).
 */
export const getScreen = (): Screen | null => cachedScreen;

/**
 * Persist the screen identity so the app can re-render it directly on next launch.
 */
export const setScreen = async (screen: Screen): Promise<void> => {
  cachedScreen = screen;
  await AsyncStorage.setItem(SCREEN_KEY, JSON.stringify(screen));
};

/**
 * Clear the persisted screen identity (e.g. on logout).
 */
export const clearScreen = async (): Promise<void> => {
  cachedScreen = null;
  await AsyncStorage.removeItem(SCREEN_KEY);
};

/**
 * Hydrate the screen cache from storage on app start.
 */
export const initScreen = async (): Promise<Screen | null> => {
  const stored = await AsyncStorage.getItem(SCREEN_KEY);
  if (stored) {
    try {
      cachedScreen = JSON.parse(stored) as Screen;
    } catch {
      cachedScreen = null;
    }
  }
  return cachedScreen;
};
