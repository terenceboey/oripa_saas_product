"use client";

import { useEffect } from "react";

type RefreshFn = () => void | Promise<void>;

export function useBackForwardRefresh(refresh: RefreshFn) {
  useEffect(() => {
    const run = () => {
      void refresh();
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
  }, [refresh]);
}
