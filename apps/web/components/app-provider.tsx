"use client";

import { MantineProvider, createTheme } from "@mantine/core";
import { Suspense, type ReactNode } from "react";
import { RouteTransitionLoader } from "./route-transition-loader";

const theme = createTheme({
  primaryColor: "grape",
  defaultRadius: "md",
  fontFamily: 'var(--font-body), "Segoe UI", Helvetica, Arial, sans-serif',
  headings: {
    fontFamily: 'var(--font-display), var(--font-body), "Segoe UI", sans-serif',
  },
});

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Suspense fallback={null}>
        <RouteTransitionLoader />
      </Suspense>
      {children}
    </MantineProvider>
  );
}
