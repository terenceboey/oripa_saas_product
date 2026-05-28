"use client";

import { useEffect, useRef } from "react";

type RefreshFn = () => void | Promise<void>;
type RefreshOptions = {
  enabled?: boolean;
  cooldownMs?: number;
};

export function useBackForwardRefresh(refresh: RefreshFn, options?: RefreshOptions) {
  const inFlightRef = useRef(false);
  const lastRunRef = useRef(0);
  const cooldownMs = options?.cooldownMs ?? 10000;
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;

    const run = () => {
      if (inFlightRef.current) return;
      const now = Date.now();
      if (now - lastRunRef.current < cooldownMs) return;

      inFlightRef.current = true;
      lastRunRef.current = now;
      void Promise.resolve(refresh()).finally(() => {
        inFlightRef.current = false;
      });
    };

    const onPageShow = () => {
      run();
    };
    const onPopState = () => {
      run();
    };
    const onFocus = () => {
      run();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        run();
      }
    };

    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [cooldownMs, enabled, refresh]);
}
