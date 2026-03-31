"use client";

import { useEffect } from "react";
import { observeWebVitals } from "@/lib/performance/metrics";

/**
 * Bootstraps Core Web Vitals observation once the client mounts.
 * Renders nothing — purely a side-effect component.
 */
export function PerformanceObserverBootstrap() {
  useEffect(() => {
    observeWebVitals();
  }, []);

  return null;
}
