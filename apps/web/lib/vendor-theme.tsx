"use client";

import { useEffect, useMemo, type CSSProperties, type ReactNode } from "react";
import { MantineProvider, createTheme, type MantineColorsTuple, type MantineThemeOverride } from "@mantine/core";
import { vendorThemePresetIds } from "@oripa/shared";

export type VendorStorefrontTheme = {
  storefrontThemePreset?: string | null;
  storefrontPrimary: string;
  storefrontSecondary: string;
  storefrontAccent: string;
  storefrontSurface: string;
  storefrontText: string;
  storefrontMuted: string;
  storefrontRadius: number;
};

type VendorThemePresetId = (typeof vendorThemePresetIds)[number];

type VendorThemePreset = {
  id: VendorThemePresetId;
  label: string;
  storefrontPrimary: string;
  storefrontSecondary: string;
  storefrontAccent: string;
  storefrontSurface: string;
  storefrontText: string;
  storefrontMuted: string;
  storefrontRadius: number;
};

export const VENDOR_THEME_PRESETS: VendorThemePreset[] = [
  {
    id: "lavender-dawn",
    label: "Lavender Dawn",
    storefrontPrimary: "#7A5CFA",
    storefrontSecondary: "#EEE7FF",
    storefrontAccent: "#A66BFF",
    storefrontSurface: "#FFFFFF",
    storefrontText: "#2D2350",
    storefrontMuted: "#6E6395",
    storefrontRadius: 18,
  },
  {
    id: "mint-cloud",
    label: "Mint Cloud",
    storefrontPrimary: "#4FB7A5",
    storefrontSecondary: "#E2F7F3",
    storefrontAccent: "#7A8BFF",
    storefrontSurface: "#FFFFFF",
    storefrontText: "#1F3B44",
    storefrontMuted: "#5E7F86",
    storefrontRadius: 18,
  },
  {
    id: "peach-sorbet",
    label: "Peach Sorbet",
    storefrontPrimary: "#F28D8D",
    storefrontSecondary: "#FFEAE5",
    storefrontAccent: "#FFB26B",
    storefrontSurface: "#FFFFFF",
    storefrontText: "#4A2A33",
    storefrontMuted: "#8E6D78",
    storefrontRadius: 18,
  },
  {
    id: "sky-bloom",
    label: "Sky Bloom",
    storefrontPrimary: "#5E8BFF",
    storefrontSecondary: "#E8EEFF",
    storefrontAccent: "#7CC8FF",
    storefrontSurface: "#FFFFFF",
    storefrontText: "#1F2F56",
    storefrontMuted: "#60739B",
    storefrontRadius: 18,
  },
  {
    id: "rose-mist",
    label: "Rose Mist",
    storefrontPrimary: "#D471B8",
    storefrontSecondary: "#FCEAF7",
    storefrontAccent: "#8D7CFF",
    storefrontSurface: "#FFFFFF",
    storefrontText: "#3D2747",
    storefrontMuted: "#7B6687",
    storefrontRadius: 18,
  },
  {
    id: "midnight-prism",
    label: "Midnight Prism",
    storefrontPrimary: "#8C6CFF",
    storefrontSecondary: "#211A36",
    storefrontAccent: "#D86BFF",
    storefrontSurface: "#120F1E",
    storefrontText: "#F4F0FF",
    storefrontMuted: "#B8A9D9",
    storefrontRadius: 22,
  },
  {
    id: "cosmic-violet",
    label: "Cosmic Violet",
    storefrontPrimary: "#7E5CFF",
    storefrontSecondary: "#1A1430",
    storefrontAccent: "#6DE0FF",
    storefrontSurface: "#0E1020",
    storefrontText: "#F2F6FF",
    storefrontMuted: "#9BA8CF",
    storefrontRadius: 20,
  },
  {
    id: "emerald-night",
    label: "Emerald Night",
    storefrontPrimary: "#35D0A2",
    storefrontSecondary: "#102821",
    storefrontAccent: "#B5FF6B",
    storefrontSurface: "#0B1715",
    storefrontText: "#ECFFF8",
    storefrontMuted: "#91B9AA",
    storefrontRadius: 20,
  },
  {
    id: "pearl-aurora",
    label: "Pearl Aurora",
    storefrontPrimary: "#7F6BFF",
    storefrontSecondary: "#ECE8FF",
    storefrontAccent: "#60D8FF",
    storefrontSurface: "#FFFDFB",
    storefrontText: "#25203F",
    storefrontMuted: "#756E92",
    storefrontRadius: 22,
  },
  {
    id: "champagne-glow",
    label: "Champagne Glow",
    storefrontPrimary: "#D99A3D",
    storefrontSecondary: "#FFF0D8",
    storefrontAccent: "#FF6F91",
    storefrontSurface: "#FFF9F1",
    storefrontText: "#3F2B22",
    storefrontMuted: "#8A7565",
    storefrontRadius: 20,
  },
  {
    id: "frosted-orchid",
    label: "Frosted Orchid",
    storefrontPrimary: "#C767D8",
    storefrontSecondary: "#F6E9FF",
    storefrontAccent: "#6F8DFF",
    storefrontSurface: "#FFFFFF",
    storefrontText: "#332341",
    storefrontMuted: "#806D91",
    storefrontRadius: 22,
  },
];

export const DEFAULT_VENDOR_THEME_PRESET_ID: VendorThemePresetId = "lavender-dawn";

export function resolveVendorThemePresetId(theme: VendorStorefrontTheme | null | undefined): VendorThemePresetId | null {
  if (!theme) return null;
  if (theme.storefrontThemePreset && vendorThemePresetIds.includes(theme.storefrontThemePreset as VendorThemePresetId)) {
    return theme.storefrontThemePreset as VendorThemePresetId;
  }

  const match = VENDOR_THEME_PRESETS.find((preset) =>
    preset.storefrontPrimary === theme.storefrontPrimary &&
    preset.storefrontSecondary === theme.storefrontSecondary &&
    preset.storefrontAccent === theme.storefrontAccent &&
    preset.storefrontSurface === theme.storefrontSurface &&
    preset.storefrontText === theme.storefrontText &&
    preset.storefrontMuted === theme.storefrontMuted &&
    preset.storefrontRadius === theme.storefrontRadius
  );

  return match?.id ?? null;
}

function getThemePreset(theme: VendorStorefrontTheme | null | undefined): VendorThemePreset | null {
  const presetId = resolveVendorThemePresetId(theme);
  if (!presetId) return null;
  return VENDOR_THEME_PRESETS.find((preset) => preset.id === presetId) ?? null;
}

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return [122, 92, 250];
  }
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((channel) => clampByte(channel).toString(16).padStart(2, "0")).join("");
}

function mix(hexA: string, hexB: string, amount: number) {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const ratio = Math.max(0, Math.min(1, amount));
  return rgbToHex(r1 + (r2 - r1) * ratio, g1 + (g2 - g1) * ratio, b1 + (b2 - b1) * ratio);
}

function buildPalette(baseColor: string): MantineColorsTuple {
  return [
    mix(baseColor, "#ffffff", 0.94),
    mix(baseColor, "#ffffff", 0.86),
    mix(baseColor, "#ffffff", 0.74),
    mix(baseColor, "#ffffff", 0.62),
    mix(baseColor, "#ffffff", 0.48),
    baseColor,
    mix(baseColor, "#000000", 0.08),
    mix(baseColor, "#000000", 0.18),
    mix(baseColor, "#000000", 0.3),
    mix(baseColor, "#000000", 0.44),
  ];
}

export function buildVendorMantineTheme(theme: VendorStorefrontTheme | null | undefined): MantineThemeOverride | null {
  if (!theme) return null;
  const preset = getThemePreset(theme);
  const paletteSource = preset ?? theme;

  return createTheme({
    primaryColor: "vendor",
    primaryShade: { light: 6, dark: 7 },
    autoContrast: true,
    defaultRadius: paletteSource.storefrontRadius,
    colors: {
      vendor: buildPalette(paletteSource.storefrontPrimary),
      vendorAccent: buildPalette(paletteSource.storefrontAccent),
      vendorSurface: buildPalette(paletteSource.storefrontSurface),
    },
    components: {
      Button: { defaultProps: { radius: paletteSource.storefrontRadius } },
      Card: { defaultProps: { radius: paletteSource.storefrontRadius } },
      Paper: { defaultProps: { radius: paletteSource.storefrontRadius } },
      Badge: { defaultProps: { radius: paletteSource.storefrontRadius } },
      ActionIcon: { defaultProps: { radius: paletteSource.storefrontRadius } },
      Input: { defaultProps: { radius: paletteSource.storefrontRadius } },
      Drawer: { defaultProps: { radius: paletteSource.storefrontRadius } },
      Modal: { defaultProps: { radius: paletteSource.storefrontRadius } },
    },
    other: {
      vendor: {
        presetId: preset?.id ?? null,
        primary: paletteSource.storefrontPrimary,
        secondary: paletteSource.storefrontSecondary,
        accent: paletteSource.storefrontAccent,
        surface: paletteSource.storefrontSurface,
        text: paletteSource.storefrontText,
        muted: paletteSource.storefrontMuted,
        radius: paletteSource.storefrontRadius,
      },
    },
  });
}

export function buildVendorCssVariables(theme: VendorStorefrontTheme | null | undefined): CSSProperties | undefined {
  if (!theme) return undefined;
  const preset = getThemePreset(theme);
  const paletteSource = preset ?? theme;

  return {
    ["--brand" as string]: paletteSource.storefrontPrimary,
    ["--card" as string]: paletteSource.storefrontSurface,
    ["--text" as string]: paletteSource.storefrontText,
    ["--muted" as string]: paletteSource.storefrontMuted,
    ["--border" as string]: paletteSource.storefrontSecondary,
    ["--brand-soft" as string]: paletteSource.storefrontSecondary,
    ["--brand-accent" as string]: paletteSource.storefrontAccent,
    ["--radius-lg" as string]: `${paletteSource.storefrontRadius}px`,
  } as CSSProperties;
}

export function VendorThemeProvider({
  theme,
  children,
}: {
  theme?: VendorStorefrontTheme | null;
  children: ReactNode;
}) {
  const nextTheme = useMemo(() => buildVendorMantineTheme(theme), [theme]);
  const cssVariables = useMemo(() => buildVendorCssVariables(theme), [theme]);

  useEffect(() => {
    if (!cssVariables || typeof document === "undefined") return;
    const root = document.documentElement;
    const previousValues = new Map<string, string>();

    Object.entries(cssVariables).forEach(([key, value]) => {
      previousValues.set(key, root.style.getPropertyValue(key));
      root.style.setProperty(key, String(value));
    });

    return () => {
      previousValues.forEach((value, key) => {
        if (value) {
          root.style.setProperty(key, value);
        } else {
          root.style.removeProperty(key);
        }
      });
    };
  }, [cssVariables]);

  if (!nextTheme) return <>{children}</>;
  return <MantineProvider theme={nextTheme}>{children}</MantineProvider>;
}
