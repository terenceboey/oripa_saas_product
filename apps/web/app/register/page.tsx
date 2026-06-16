"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Alert, Anchor, Button, Container, Divider, Group, Paper, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { applyVendorFavicon } from "../../lib/favicon";
import { normalizeVendorFaviconUrl, normalizeVendorLogoUrl } from "../../lib/media-url";
import { VendorThemeProvider } from "../../lib/vendor-theme";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const clientPageHeader = { "x-client-page": "/register" };

function buildVendorLoginUrl(vendorHost: string, error?: string | null) {
  const host = String(vendorHost ?? "").trim().toLowerCase();
  const url = new URL("/vendor/login", window.location.origin);
  if (host && host !== window.location.host.toLowerCase()) {
    url.host = host;
  }
  if (error) url.searchParams.set("error", error);
  return url.toString();
}
type VendorTheme = {
  storefrontThemePreset?: string | null;
  storefrontPrimary: string;
  storefrontSecondary: string;
  storefrontAccent: string;
  storefrontSurface: string;
  storefrontText: string;
  storefrontMuted: string;
  storefrontRadius: number;
};
type VendorBranding = {
  logoImageUrl?: string | null;
  faviconImageUrl?: string | null;
};

export default function RegisterPage() {
  const router = useRouter();
  const runtimeVendorHost = useMemo(() => {
    if (typeof window !== "undefined" && window.location?.host) return window.location.host.toLowerCase();
    return configuredVendorHost;
  }, []);
  const [referralCode, setReferralCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [theme, setTheme] = useState<VendorTheme | null>(null);
  const [branding, setBranding] = useState<VendorBranding | null>(null);
  const socialBase = useMemo(() => `${apiBase}/v1/auth`, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const ref = String(url.searchParams.get("ref") ?? "").trim().toLowerCase();
    if (ref) setReferralCode(ref);
    void (async () => {
      const response = await fetch(`${apiBase}/v1/vendor/me`, {
        headers: { ...clientPageHeader },
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && Boolean(payload?.isVendorMember)) {
        router.replace("/vendor");
        return;
      }
    })();
    void (async () => {
      const response = await fetch(`${apiBase}/v1/auth/me`, {
        headers: clientPageHeader,
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.user?.email) {
        setUser({ email: String(payload.user.email) });
      }
    })();
    void fetch(`${apiBase}/v1/vendor/current`, {
      headers: { ...clientPageHeader },
      credentials: "include",
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        setTheme(payload?.vendor?.vendorSettings ?? null);
        setBranding({
          logoImageUrl: normalizeVendorLogoUrl(payload?.vendor?.logoImageUrl) || null,
          faviconImageUrl: normalizeVendorFaviconUrl(payload?.vendor?.faviconImageUrl, payload?.vendor?.logoImageUrl) || null,
        });
      })
      .catch(() => null);
  }, []);

  async function logout() {
    await fetch(`${apiBase}/v1/auth/logout`, {
      method: "POST",
      headers: clientPageHeader,
      credentials: "include",
      cache: "no-store",
    }).catch(() => null);
    setUser(null);
    setMessage("You have been logged out.");
  }

  const storefrontThemeStyle = useMemo(() => {
    if (!theme) return undefined;
    return {
      ["--brand" as string]: theme.storefrontPrimary,
      ["--card" as string]: theme.storefrontSurface,
      ["--text" as string]: theme.storefrontText,
      ["--muted" as string]: theme.storefrontMuted,
      ["--border" as string]: theme.storefrontSecondary,
      ["--brand-soft" as string]: theme.storefrontSecondary,
      ["--brand-accent" as string]: theme.storefrontAccent,
      ["--radius-lg" as string]: `${theme.storefrontRadius}px`,
    } as CSSProperties;
  }, [theme]);

  useEffect(() => {
    applyVendorFavicon(normalizeVendorFaviconUrl(branding?.faviconImageUrl, branding?.logoImageUrl));
  }, [branding?.faviconImageUrl, branding?.logoImageUrl]);

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`${apiBase}/v1/auth/register`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...clientPageHeader,
        },
        credentials: "include",
        body: JSON.stringify({ email, password, referralCode: referralCode || undefined }),
      });

      const payload = await response.json();
      if (!response.ok) {
        if (payload?.vendorHost || String(payload?.error ?? "").toLowerCase().includes("vendor account")) {
          window.location.href = buildVendorLoginUrl(String(payload?.vendorHost ?? runtimeVendorHost), "vendor_account");
          return;
        }
        throw new Error(payload.error ?? "Registration failed");
      }

      setMessage("Account created. Please verify OTP sent to your email.");
      setPassword("");
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  function startGoogleRegister(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const host = window.location.host.toLowerCase();
    const url = new URL(`${socialBase}/google/start`);
    url.searchParams.set("vendorHost", host);
    url.searchParams.set("intent", "customer_register");
    if (referralCode) url.searchParams.set("referralCode", referralCode);
    window.location.href = url.toString();
  }

  return (
    <VendorThemeProvider theme={theme}>
      <Container size="sm" py="xl" style={storefrontThemeStyle}>
        <Paper radius="xl" p="xl" shadow="md" withBorder>
        <Group justify="space-between" mb="xl">
          <Button component={Link} href="/" variant="light" radius="md">
            Back to Home
          </Button>
          {user ? (
            <Button variant="subtle" onClick={() => void logout()} radius="md">
              Logout
            </Button>
          ) : null}
        </Group>

        <Stack gap="lg">
          <div>
            <Title order={1}>Create Customer Account</Title>
            <Text c="dimmed" mt={6}>
              Create a customer account first. After email verification, we will take you to the customer information page. Vendor applications use a separate approval flow.
            </Text>
          </div>

          <form onSubmit={handleRegister}>
            <Stack gap="md">
              <TextInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
              <PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (8+ chars)" minLength={8} required />
              <Button type="submit" loading={loading} radius="md">
                Create Customer Account
              </Button>
            </Stack>
          </form>

          <Divider label="Other login options" labelPosition="center" />
          <Button component="a" href="#" onClick={startGoogleRegister} variant="light" radius="md">
            Continue with Google
          </Button>

          {error ? <Alert color="red" title="Registration error">{error}</Alert> : null}
          {message ? <Alert color="green" title="Status">{message}</Alert> : null}

          <Text c="dimmed">
            Already have a customer account? <Anchor component={Link} href="/login">Login</Anchor>
          </Text>
        </Stack>
        </Paper>
      </Container>
    </VendorThemeProvider>
  );
}




