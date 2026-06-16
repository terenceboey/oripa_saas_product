"use client";

import Link from "next/link";
import { useMemo, useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Alert, Anchor, Button, Container, Group, Paper, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const clientPageHeader = { "x-client-page": "/vendor/register" };
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

export default function VendorRegisterPage() {
  return (
    <Suspense fallback={<VendorRegisterShell />}>
      <VendorRegisterContent />
    </Suspense>
  );
}

function VendorRegisterShell() {
  return (
    <Container size="sm" py="xl">
      <Paper radius="xl" p="xl" shadow="md" withBorder>
        <Stack gap="sm">
          <Title order={1}>Vendor Register</Title>
          <Text c="dimmed">Loading vendor onboarding...</Text>
        </Stack>
      </Paper>
    </Container>
  );
}

function VendorRegisterContent() {
  const router = useRouter();
  const runtimeVendorHost = useMemo(() => {
    if (typeof window !== "undefined" && window.location?.host) {
      const host = window.location.host.toLowerCase();
      return isLocalhostLike(host) ? configuredVendorHost : host;
    }
    return configuredVendorHost;
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [isVendorMember, setIsVendorMember] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`${apiBase}/v1/vendor/me`, {
          headers: { ...clientPageHeader },
          credentials: "include",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        if (active && response.ok && Boolean(payload?.isVendorMember)) {
          setIsVendorMember(true);
          router.replace("/vendor");
        }
      } finally {
        if (active) setInitializing(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [router, runtimeVendorHost]);

  function startGoogleVendorRegister(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const url = new URL(`${socialBase}/google/start`);
    url.searchParams.set("vendorHost", runtimeVendorHost);
    url.searchParams.set("intent", "vendor_register");
    window.location.href = url.toString();
  }

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

  async function handleVendorRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`${apiBase}/v1/auth/vendor/register`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...clientPageHeader,
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Vendor registration failed");

      setMessage("Account created. We sent an OTP to your email.");
      const nextUrl = String(payload.nextUrl ?? "");
      const fallbackUrl = new URL(`${apiBase}/verify-email`);
      fallbackUrl.searchParams.set("email", email);
      fallbackUrl.searchParams.set("vendorHost", runtimeVendorHost);
      fallbackUrl.searchParams.set("returnTo", "/vendor/profile");
      window.setTimeout(() => {
        window.location.assign(nextUrl || `${fallbackUrl.pathname}${fallbackUrl.search}`);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vendor registration failed");
    } finally {
      setLoading(false);
    }
  }

  const displayMessage = message ?? (initializing ? "Checking vendor session..." : null);

  if (initializing || isVendorMember) {
    return (
      <main className="container">
        <section className="card auth-card">
          <h1>Vendor Register</h1>
          <p className="muted">Loading vendor onboarding...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="container">
      <Container size="sm" py="xl">
        <Paper radius="xl" p="xl" shadow="md" withBorder>
          <Group justify="space-between" mb="xl">
            <Button component={Link} href="/" variant="light" radius="md">
              Back to Home
            </Button>
            <Button component={Link} href="/vendor/login" variant="subtle" radius="md">
              Vendor Login
            </Button>
            {isVendorMember ? (
              <Button variant="subtle" onClick={() => void logout()} radius="md">
                Logout
              </Button>
            ) : null}
          </Group>

          <Stack gap="lg">
            <div>
              <Title order={1}>Vendor Registration</Title>
              <Text c="dimmed" mt={6}>
                Create your vendor account first. We will send an OTP to your email, then unlock the vendor business profile fields.
              </Text>
            </div>

            <form onSubmit={handleVendorRegister}>
              <Stack gap="md">
                <TextInput label="Vendor email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Vendor email" required />
                <PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (8+ chars)" minLength={8} required />
                <Button type="submit" loading={loading} radius="md">
                  Create Vendor Account
                </Button>
              </Stack>
            </form>

            <Button component="a" href="#" onClick={startGoogleVendorRegister} variant="light" radius="md">
              Vendor register with Google
            </Button>

            {displayMessage ? <Alert color="green" title="Status">{displayMessage}</Alert> : null}
            {error ? <Alert color="red" title="Registration error">{error}</Alert> : null}

            <Text c="dimmed">
              Already have a vendor account? <Anchor component={Link} href="/vendor/login">Vendor login</Anchor>
            </Text>
          </Stack>
        </Paper>
      </Container>
    </main>
  );
}
