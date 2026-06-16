"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, Anchor, Button, Container, Paper, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { apiBaseUrl, apiFetch } from "../../../lib/api";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const response = await apiFetch(`${apiBaseUrl}/v1/super-admin/me`, {
          credentials: "include",
          cache: "no-store",
        });
        if (response.ok) {
          router.replace("/super-admin");
          return;
        }
      } finally {
        setChecking(false);
      }
    })();
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await apiFetch(`${apiBaseUrl}/v1/auth/super-admin/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Super admin login failed");

      setMessage("Super admin login successful.");
      window.setTimeout(() => {
        router.replace(String(payload.redirectTo ?? "/super-admin"));
      }, 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Super admin login failed");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <Container size="sm" py="xl">
        <Paper radius="xl" p="xl" shadow="md" withBorder>
          <Stack gap="sm">
            <Title order={1}>Super Admin Login</Title>
            <Text c="dimmed">Checking session...</Text>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="sm" py="xl">
      <Paper radius="xl" p="xl" shadow="md" withBorder>
        <Button component={Link} href="/" variant="light" radius="md" mb="xl">
          Back to Home
        </Button>

        <Stack gap="lg">
          <div>
            <Title order={1}>Super Admin Login</Title>
            <Text c="dimmed" mt={6}>
              This area is restricted to the single platform super admin account.
            </Text>
          </div>

          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <TextInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Super admin email" required />
              <PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
              <Button type="submit" loading={loading} radius="md">
                Sign in as Super Admin
              </Button>
            </Stack>
          </form>

          {message ? <Alert color="green" title="Status">{message}</Alert> : null}
          {error ? <Alert color="red" title="Login error">{error}</Alert> : null}
        </Stack>
      </Paper>
    </Container>
  );
}
