import "./globals.css";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import type { Metadata } from "next";
import { Inter, Rajdhani } from "next/font/google";
import { headers } from "next/headers";
import { CsrfBootstrap } from "../components/csrf-bootstrap";
import { AppProvider } from "../components/app-provider";
import { fetchVendorByHost } from "../lib/api";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Oripa SaaS Starter",
  description: "Multi-tenant mystery-pack SaaS starter",
};

type InitialVendorTheme = {
  storefrontPrimary: string;
  storefrontSecondary: string;
  storefrontAccent: string;
  storefrontSurface: string;
  storefrontText: string;
  storefrontMuted: string;
  storefrontRadius: number;
  storefrontThemePreset?: string | null;
};

function isLocalhostLike(host: string) {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.startsWith("localhost:") ||
    normalized === "demo.localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.startsWith("127.0.0.1") ||
    normalized.startsWith("0.0.0.0")
  );
}

function normalizeRequestHost(rawHost: string) {
  const host = rawHost.trim().toLowerCase();
  if (!host) return "";
  if (isLocalhostLike(host)) return process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
  return host;
}

function buildInitialThemeStyle(theme?: InitialVendorTheme | null): React.CSSProperties | undefined {
  if (!theme) return undefined;
  return {
    ["--brand" as string]: theme.storefrontPrimary,
    ["--primary" as string]: theme.storefrontPrimary,
    ["--card" as string]: theme.storefrontSurface,
    ["--surface" as string]: theme.storefrontSurface,
    ["--text" as string]: theme.storefrontText,
    ["--muted" as string]: theme.storefrontMuted,
    ["--border" as string]: theme.storefrontSecondary,
    ["--brand-soft" as string]: theme.storefrontSecondary,
    ["--secondary" as string]: theme.storefrontSecondary,
    ["--brand-accent" as string]: theme.storefrontAccent,
    ["--mini-primary" as string]: theme.storefrontPrimary,
    ["--mini-secondary" as string]: theme.storefrontSecondary,
    ["--mini-surface" as string]: theme.storefrontSurface,
    ["--mini-text" as string]: theme.storefrontText,
    ["--mini-muted" as string]: theme.storefrontMuted,
    ["--mini-accent" as string]: theme.storefrontAccent,
    ["--mantine-color-text" as string]: theme.storefrontText,
    ["--mantine-color-dimmed" as string]: theme.storefrontMuted,
    ["--mantine-color-body" as string]: theme.storefrontSurface,
    ["--mantine-color-default-border" as string]: theme.storefrontSecondary,
    ["--radius-lg" as string]: `${theme.storefrontRadius}px`,
  };
}

async function getInitialVendorTheme() {
  const requestHeaders = await headers();
  const host = normalizeRequestHost(requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "");
  if (!host) return null;
  const payload = await fetchVendorByHost(host).catch(() => null);
  return (payload?.vendor?.vendorSettings ?? null) as InitialVendorTheme | null;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialTheme = await getInitialVendorTheme();
  const initialThemeStyle = buildInitialThemeStyle(initialTheme);
  const initialThemePreset = initialTheme?.storefrontThemePreset || (initialTheme ? "custom" : undefined);

  return (
    <html
      lang="en"
      className={`${inter.variable} ${rajdhani.variable}`}
      style={initialThemeStyle}
      data-vendor-theme-active={initialTheme ? "true" : undefined}
      data-vendor-theme-preset={initialThemePreset}
    >
      <body>
        <AppProvider>
          <CsrfBootstrap />
          {children}
        </AppProvider>
      </body>
    </html>
  );
}




