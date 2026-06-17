"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Alert, Anchor, Button, Container, Paper, Stack, Text, Title } from "@mantine/core";
import { StorefrontFooter } from "../../../components/storefront-footer";
import { buildVendorCssVariables, type VendorStorefrontTheme, VendorThemeProvider } from "../../../lib/vendor-theme";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const clientPageHeader = { "x-client-page": "/auth/complete" };

type AuthUser = {
  id: string;
  email: string;
  profileComplete?: boolean;
};

type Tenant = {
  name?: string | null;
  vendorSettings?: VendorStorefrontTheme | null;
};

export default function AuthCompletePage() {
  return (
    <Suspense fallback={<AuthCompleteShell message="Finishing sign-in..." />}>
      <AuthCompleteContent />
    </Suspense>
  );
}

function AuthCompleteShell({ message }: { message: string }) {
  return (
    <Container size="sm" py="xl">
      <Paper withBorder radius="xl" p="xl" shadow="sm">
        <Stack gap="sm">
          <Title order={1}>Finishing Customer Sign-In</Title>
          <Text c="dimmed">{message}</Text>
        </Stack>
      </Paper>
    </Container>
  );
}

function AuthCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("Checking your account...");
  const [tenant, setTenant] = useState<Tenant | null>(null);

  const runtimeVendorHost = useMemo(() => {
    const queryHost = String(searchParams.get("vendorHost") ?? "").trim().toLowerCase();
    if (queryHost) return queryHost;
    if (typeof window !== "undefined" && window.location?.host) return window.location.host.toLowerCase();
    return configuredVendorHost;
  }, [searchParams]);
  const storefrontThemeStyle = useMemo(() => buildVendorCssVariables(tenant?.vendorSettings), [tenant?.vendorSettings]);

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

  async function loadProfileWithRetry() {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await fetch(`${apiBase}/v1/auth/me`, {
        headers: clientPageHeader,
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) return (payload.user ?? null) as AuthUser | null;
      lastError = new Error(payload.error ?? "Unable to confirm your login session.");
      await new Promise((resolve) => window.setTimeout(resolve, 250 + attempt * 200));
    }
    throw lastError ?? new Error("Unable to confirm your login session.");
  }

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const vendorAccess = await fetch(`${apiBase}/v1/vendor/me`, {
          headers: { ...clientPageHeader },
          credentials: "include",
          cache: "no-store",
        });
        const vendorPayload = await vendorAccess.json().catch(() => ({}));
        if (active && vendorAccess.ok && Boolean(vendorPayload?.isVendorMember)) {
          router.replace("/vendor");
          return;
        }

        const nextUser = await loadProfileWithRetry();
        if (!active) return;
        if (!nextUser?.profileComplete) {
          setMessage("Taking you to the customer information page...");
          router.replace(`/profile?vendorHost=${encodeURIComponent(runtimeVendorHost)}`);
          return;
        }

        router.replace("/");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to finish sign-in.");
        setMessage("We could not confirm your login session.");
      }
    })();

    return () => {
      active = false;
    };
  }, [router, runtimeVendorHost]);

  return (
    <VendorThemeProvider theme={tenant?.vendorSettings}>
    <Container size="sm" py="xl" style={storefrontThemeStyle}>
      <Paper withBorder radius="xl" p="xl" shadow="sm">
        <Stack gap="md">
          <Title order={1}>Finishing Customer Sign-In</Title>
          <Text c="dimmed">{message}</Text>
          {error ? (
            <Alert color="red" variant="light">
              {error} <Anchor component={Link} href="/login">Return to login</Anchor>
            </Alert>
          ) : null}
          <Button component={Link} href="/" variant="subtle">
            Return to homepage
          </Button>
        </Stack>
      </Paper>
      <StorefrontFooter brandName={tenant?.name ?? "Storefront"} host={runtimeVendorHost} />
    </Container>
    </VendorThemeProvider>
  );
}
