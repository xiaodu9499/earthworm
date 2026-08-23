export const SOFT_KEYBOARD_MIN_COVERED_HEIGHT = 120;

export type SoftKeyboardViewportSignals = {
  baselineHeight: number;
  visibleHeight: number;
  textEntryFocused: boolean;
};

export function resolveSoftKeyboardViewport({
  baselineHeight,
  visibleHeight,
  textEntryFocused,
}: SoftKeyboardViewportSignals) {
  const normalizedVisibleHeight = Math.max(0, Math.round(visibleHeight));
  const coveredHeight = Math.max(0, Math.round(baselineHeight) - normalizedVisibleHeight);

  return {
    height: normalizedVisibleHeight,
    coveredHeight,
    keyboardOpen: textEntryFocused && coveredHeight >= SOFT_KEYBOARD_MIN_COVERED_HEIGHT,
  };
}
