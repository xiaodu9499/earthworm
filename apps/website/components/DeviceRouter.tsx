"use client";

import { detectBrowserDeviceExperience, routeForDevice } from "@/lib/device-routing";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Root-only device dispatcher. Detection runs once after hydration; destination
 * pages do not install resize listeners and therefore remain stable.
 */
export default function DeviceRouter() {
  const router = useRouter();
  const hasRouted = useRef(false);

  useEffect(() => {
    if (hasRouted.current) return;
    hasRouted.current = true;
    router.replace(routeForDevice(detectBrowserDeviceExperience()));
  }, [router]);

  return (
    <main
      aria-busy="true"
      aria-live="polite"
      style={{
        alignItems: "center",
        background: "#f7f5ef",
        color: "#36523d",
        display: "flex",
        fontFamily: "system-ui, sans-serif",
        justifyContent: "center",
        minHeight: "100dvh",
      }}
    >
      正在打开 Earthworm…
    </main>
  );
}
