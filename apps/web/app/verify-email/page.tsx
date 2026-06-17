"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Alert, Anchor, Button, Container, Group, Paper, Stack, Text, TextInput, Title } from "@mantine/core";
import { StorefrontFooter } from "../../components/storefront-footer";
import { buildVendorCssVariables, type VendorStorefrontTheme, VendorThemeProvider } from "../../lib/vendor-theme";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const clientPageHeader = { "x-client-page": "/verify-email" };

type Tenant = {
  name?: string | null;
  vendorSettings?: VendorStorefrontTheme | null;
};

export default function VerifyEmailPage() {
  const router = useRouter();
  const runtimeVendorHost = useMemo(() => {
    const queryHost = typeof window !== "undefined" ? new URL(window.location.href).searchParams.get("vendorHost") : null;
    if (queryHost?.trim()) return queryHost.trim().toLowerCase();
    if (typeof window !== "undefined" && window.location?.host) return window.location.host.toLowerCase();
    return configuredVendorHost;
  }, []);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const returnTo = useMemo(() => {
    const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
    const raw = String(url?.searchParams.get("returnTo") ?? "").trim();
    if (raw.startsWith("/")) return raw;
    return `/profile?vendorHost=${encodeURIComponent(runtimeVendorHost)}`;
  }, [runtimeVendorHost]);
  const storefrontThemeStyle = useMemo(() => buildVendorCssVariables(tenant?.vendorSettings), [tenant?.vendorSettings]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const qEmail = String(url.searchParams.get("email") ?? "").trim();
    if (qEmail) setEmail(qEmail);
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`${apiBase}/v1/vendor/current`, {
      headers: clientPageHeader,
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((payload) => {
        if (!active || !payload) return;
        setTenant((payload.vendor ?? payload.tenant ?? null) as Tenant | null);
      })
      .catch(() => {
        if (!active) return;
        setTenant(null);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${apiBase}/v1/auth/verify-email-otp`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...clientPageHeader,
        },
        credentials: "include",
        body: JSON.stringify({ email, otp }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "OTP verification failed");

      setMessage("Email verified and login successful.");
      setOtp("");
      window.setTimeout(() => {
        if (returnTo.startsWith("/vendor") && runtimeVendorHost && window.location.host.toLowerCase() !== runtimeVendorHost) {
          window.location.assign(`${window.location.protocol}//${runtimeVendorHost}${returnTo}`);
          return;
        }
        router.push(returnTo);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    setResending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${apiBase}/v1/auth/resend-email-otp`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...clientPageHeader,
        },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Failed to resend OTP");
      setMessage("OTP sent. Please check your email.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend OTP");
    } finally {
      setResending(false);
    }
  }

  return (
    <VendorThemeProvider theme={tenant?.vendorSettings}>
    <Container size="sm" py="xl" style={storefrontThemeStyle}>
      <Paper radius="xl" p="xl" shadow="md" withBorder>
        <Button component={Link} href="/" variant="light" radius="md" mb="xl">
          Back to Home
        </Button>
        <Stack gap="lg">
          <div>
            <Title order={1}>Verify Email</Title>
            <Text c="dimmed" mt={6}>
              Enter the 6-digit OTP sent to your email to activate your account.
            </Text>
          </div>
          <form onSubmit={handleVerify}>
            <Stack gap="md">
              <TextInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
              <TextInput label="6-digit OTP" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit OTP" inputMode="numeric" pattern="\d{6}" required />
              <Group>
                <Button type="submit" loading={loading} radius="md">
                  Verify OTP
                </Button>
                <Button type="button" variant="default" loading={resending} onClick={resendOtp} radius="md">
                  Resend OTP
                </Button>
              </Group>
            </Stack>
          </form>
          {error ? <Alert color="red" title="Verification error">{error}</Alert> : null}
          {message ? <Alert color="green" title="Status">{message}</Alert> : null}
          <Text c="dimmed">
            Already verified? <Anchor component={Link} href="/login">Login</Anchor>
          </Text>
        </Stack>
      </Paper>
      <StorefrontFooter brandName={tenant?.name ?? "Storefront"} host={runtimeVendorHost} />
    </Container>
    </VendorThemeProvider>
  );
}




