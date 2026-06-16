"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Anchor, Button, Container, Group, Paper, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const clientPageHeader = { "x-client-page": "/vendor/login" };
const socialBase = `${apiBase}/v1/auth`;

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

export default function VendorLoginPage() {
  return (
    <Suspense fallback={<VendorLoginShell />}>
      <VendorLoginContent />
    </Suspense>
  );
}

function VendorLoginShell() {
  return (
    <Container size="sm" py="xl">
      <Paper radius="xl" p="xl" shadow="md" withBorder>
        <Stack gap="sm">
          <Title order={1}>Vendor Login</Title>
          <Text c="dimmed">Loading vendor access...</Text>
        </Stack>
      </Paper>
    </Container>
  );
}

function VendorLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runtimeVendorHost = useMemo(() => {
    if (typeof window !== "undefined" && window.location?.host) {
      const host = window.location.host.toLowerCase();
      return isLocalhostLike(host) ? configuredVendorHost : host;
    }
    return configuredVendorHost;
  }, []);
  const returnTo = useMemo(() => {
    const raw = String(searchParams.get("returnTo") ?? "/vendor");
    return raw.startsWith("/vendor") && !raw.startsWith("//") ? raw : "/vendor";
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isVendorMember, setIsVendorMember] = useState(false);

  const callbackError = String(searchParams.get("error") ?? "").trim().toLowerCase();
  const callbackStatus = String(searchParams.get("status") ?? "").trim().toLowerCase();
  const callbackErrorMessage =
    callbackError === "vendor_approval_required"
      ? "This vendor account is waiting for super admin approval."
      : callbackError === "vendor_account"
        ? "This is a vendor account. Please use the vendor login page."
        : callbackError
          ? "Vendor sign-in failed."
          : null;
  const callbackStatusMessage = callbackStatus === "pending_approval" ? "Your vendor application was submitted and is waiting for approval." : null;
  const displayError = error ?? callbackErrorMessage;
  const displayMessage = message ?? callbackStatusMessage;

  useEffect(() => {
    void (async () => {
      const response = await fetch(`${apiBase}/v1/vendor/me`, {
        headers: { ...clientPageHeader },
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && Boolean(payload?.isVendorMember)) {
        setIsVendorMember(true);
      }
    })();
  }, [runtimeVendorHost]);

  async function logout() {
    await fetch(`${apiBase}/v1/auth/logout`, {
      method: "POST",
      headers: { ...clientPageHeader },
      credentials: "include",
      cache: "no-store",
    }).catch(() => null);
    setIsVendorMember(false);
    setMessage("You have been logged out.");
  }

  function startGoogleVendorLogin(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const url = new URL(`${socialBase}/google/start`);
    url.searchParams.set("vendorHost", runtimeVendorHost);
    url.searchParams.set("intent", "vendor_login");
    window.location.href = url.toString();
  }

  async function handleVendorLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`${apiBase}/v1/auth/vendor/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...clientPageHeader,
        },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Vendor login failed");

      setMessage("Vendor login successful.");
      window.setTimeout(() => {
        router.replace(returnTo);
      }, 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vendor login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container size="sm" py="xl">
      <Paper radius="xl" p="xl" shadow="md" withBorder>
        <Group justify="space-between" mb="xl">
          <Button component={Link} href="/" variant="light" radius="md">
            Back to Home
          </Button>
          <Button component={Link} href="/vendor/register" variant="subtle" radius="md">
            Vendor Register
          </Button>
          {isVendorMember ? (
            <Button variant="subtle" onClick={() => void logout()} radius="md">
              Logout
            </Button>
          ) : null}
        </Group>

        <Stack gap="lg">
          <div>
            <Title order={1}>Vendor Login</Title>
            <Text c="dimmed" mt={6}>
              Sign in with your vendor account. Your application can still be under review while you work in the dashboard.
            </Text>
          </div>

          <form onSubmit={handleVendorLogin}>
            <Stack gap="md">
              <TextInput label="Vendor email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Vendor email" required />
              <PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
              <Button type="submit" loading={loading} radius="md">
                Vendor Login
              </Button>
            </Stack>
          </form>

          <Button component="a" href="#" onClick={startGoogleVendorLogin} variant="light" radius="md">
            Vendor login with Google
          </Button>

          {displayError ? <Alert color="red" title="Login error">{displayError}</Alert> : null}
          {displayMessage ? <Alert color="green" title="Status">{displayMessage}</Alert> : null}
        </Stack>
      </Paper>
    </Container>
  );
}
