export type DeviceExperience = "desktop" | "mobile";

export const DEVICE_PREFERENCE_STORAGE_KEY = "earthworm-website-device-preference-v1";

export const DEVICE_ROUTES: Readonly<Record<DeviceExperience, "/desktop" | "/mobile">> = {
  desktop: "/desktop",
  mobile: "/mobile",
};

export const NARROW_VIEWPORT_MAX_WIDTH = 767;
export const COARSE_POINTER_MAX_WIDTH = 1024;

type PreferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type DeviceSignals = {
  userAgent: string;
  viewportWidth: number;
  hasCoarsePointer: boolean;
};

function browserStorage(): PreferenceStorage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function isDeviceExperience(value: unknown): value is DeviceExperience {
  return value === "desktop" || value === "mobile";
}

/** Reads an explicit user choice. Invalid or unavailable storage is ignored. */
export function readDevicePreference(
  storage: PreferenceStorage | undefined = browserStorage(),
): DeviceExperience | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(DEVICE_PREFERENCE_STORAGE_KEY);
    return isDeviceExperience(value) ? value : null;
  } catch {
    return null;
  }
}

/** Saves an explicit user choice and returns whether it could be persisted. */
export function writeDevicePreference(
  preference: DeviceExperience,
  storage: PreferenceStorage | undefined = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(DEVICE_PREFERENCE_STORAGE_KEY, preference);
    return true;
  } catch {
    return false;
  }
}

/** Clears the manual override so the next root visit can detect the device. */
export function clearDevicePreference(
  storage: PreferenceStorage | undefined = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(DEVICE_PREFERENCE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function isMobileUserAgent(userAgent: string): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(userAgent);
}

/**
 * Applies device signals in a fixed order. This is intentionally pure so the
 * routing decision can be tested without browser globals.
 */
export function detectDeviceExperience(
  signals: DeviceSignals,
  manualPreference: DeviceExperience | null = null,
): DeviceExperience {
  if (manualPreference) return manualPreference;
  if (isMobileUserAgent(signals.userAgent)) return "mobile";
  if (signals.hasCoarsePointer && signals.viewportWidth <= COARSE_POINTER_MAX_WIDTH)
    return "mobile";
  if (signals.viewportWidth <= NARROW_VIEWPORT_MAX_WIDTH) return "mobile";
  return "desktop";
}

/** Browser-only convenience wrapper; call after mount rather than during SSR. */
export function detectBrowserDeviceExperience(): DeviceExperience {
  if (typeof window === "undefined") return "desktop";
  const manualPreference = readDevicePreference();
  const hasCoarsePointer =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(pointer: coarse)").matches
      : false;
  return detectDeviceExperience(
    {
      userAgent: window.navigator.userAgent,
      viewportWidth: window.innerWidth,
      hasCoarsePointer,
    },
    manualPreference,
  );
}

export function routeForDevice(experience: DeviceExperience): "/desktop" | "/mobile" {
  return DEVICE_ROUTES[experience];
}
