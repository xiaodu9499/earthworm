"use client";

import { resolveSoftKeyboardViewport } from "@/lib/soft-keyboard";
import { useEffect, useRef, useState } from "react";

function isTextEntryElement(element: Element | null) {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLElement && element.isContentEditable)
  );
}

export type SoftKeyboardViewport = {
  height: number;
  top: number;
  keyboardOpen: boolean;
};

export function useSoftKeyboardViewport(enabled = true): SoftKeyboardViewport {
  const [viewport, setViewport] = useState<SoftKeyboardViewport>({
    height: 0,
    top: 0,
    keyboardOpen: false,
  });
  const baselineHeightRef = useRef(0);
  const keyboardOpenRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const visualViewport = window.visualViewport;
    let settleTimer = 0;

    const update = () => {
      const visibleHeight = Math.round(visualViewport?.height ?? window.innerHeight);
      const visibleTop = Math.max(0, Math.round(visualViewport?.offsetTop ?? 0));
      const textEntryFocused = isTextEntryElement(document.activeElement);

      if (!textEntryFocused && !keyboardOpenRef.current) {
        baselineHeightRef.current = Math.max(window.innerHeight, visibleHeight);
      } else if (!baselineHeightRef.current) {
        baselineHeightRef.current = Math.max(window.innerHeight, visibleHeight);
      }

      const nextViewport = resolveSoftKeyboardViewport({
        baselineHeight: baselineHeightRef.current,
        visibleHeight,
        textEntryFocused,
      });
      keyboardOpenRef.current = nextViewport.keyboardOpen;
      setViewport((current) =>
        current.height === nextViewport.height &&
        current.top === visibleTop &&
        current.keyboardOpen === nextViewport.keyboardOpen
          ? current
          : {
              height: nextViewport.height,
              top: visibleTop,
              keyboardOpen: nextViewport.keyboardOpen,
            },
      );
    };

    const updateAndSettle = () => {
      update();
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(update, 80);
    };

    update();
    visualViewport?.addEventListener("resize", updateAndSettle);
    visualViewport?.addEventListener("scroll", updateAndSettle);
    window.addEventListener("resize", updateAndSettle);
    window.addEventListener("focusin", updateAndSettle);
    window.addEventListener("focusout", updateAndSettle);

    return () => {
      window.clearTimeout(settleTimer);
      visualViewport?.removeEventListener("resize", updateAndSettle);
      visualViewport?.removeEventListener("scroll", updateAndSettle);
      window.removeEventListener("resize", updateAndSettle);
      window.removeEventListener("focusin", updateAndSettle);
      window.removeEventListener("focusout", updateAndSettle);
    };
  }, [enabled]);

  return viewport;
}
