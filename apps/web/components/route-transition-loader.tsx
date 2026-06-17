"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { PackLoader } from "./pack-loader";

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

export function RouteTransitionLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const failSafeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
    }
    if (failSafeTimerRef.current !== null) {
      window.clearTimeout(failSafeTimerRef.current);
      failSafeTimerRef.current = null;
    }

    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      hideTimerRef.current = null;
    }, 180);

    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      if (failSafeTimerRef.current !== null) {
        window.clearTimeout(failSafeTimerRef.current);
        failSafeTimerRef.current = null;
      }
    };
  }, [pathname, searchParams]);

  useEffect(() => {
    function showForInternalNavigation(event: MouseEvent) {
      if (event.defaultPrevented || isModifiedClick(event)) return;
      const target = event.target instanceof Element ? event.target.closest("a") : null;
      if (!target) return;

      const href = target.getAttribute("href");
      const targetAttr = target.getAttribute("target");
      if (!href || href.startsWith("#") || targetAttr === "_blank" || target.hasAttribute("download")) return;

      const nextUrl = new URL(href, window.location.href);
      if (nextUrl.origin !== window.location.origin) return;
      if (nextUrl.pathname === window.location.pathname && nextUrl.search === window.location.search) return;

      setVisible(true);
      if (failSafeTimerRef.current !== null) {
        window.clearTimeout(failSafeTimerRef.current);
      }
      failSafeTimerRef.current = window.setTimeout(() => {
        setVisible(false);
        failSafeTimerRef.current = null;
      }, 8000);
    }

    function showForPageUnload() {
      setVisible(true);
    }

    document.addEventListener("click", showForInternalNavigation, true);
    window.addEventListener("beforeunload", showForPageUnload);

    return () => {
      document.removeEventListener("click", showForInternalNavigation, true);
      window.removeEventListener("beforeunload", showForPageUnload);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="route-loader-overlay">
      <PackLoader label="Loading" />
    </div>
  );
}
