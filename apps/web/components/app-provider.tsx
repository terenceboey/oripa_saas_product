"use client";

import { MantineProvider, createTheme } from "@mantine/core";
import type { ReactNode } from "react";

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
      {children}
    </MantineProvider>
  );
}
