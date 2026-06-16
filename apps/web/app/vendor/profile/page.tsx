"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { Button, Container, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { VendorApplicationForm } from "../../../components/vendor-application-form";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const clientPageHeader = { "x-client-page": "/vendor/profile" };

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

export default function VendorProfilePage() {
  return (
    <Suspense fallback={<VendorProfileFallback />}>
      <VendorProfileContent />
    </Suspense>
  );
}

function VendorProfileFallback() {
  return (
    <Container size="sm" py="xl">
      <Paper withBorder radius="xl" p="xl" shadow="sm">
        <Stack gap="sm">
          <Title order={1}>Vendor Profile</Title>
          <Text c="dimmed">Loading vendor profile...</Text>
        </Stack>
      </Paper>
    </Container>
  );
}

function VendorProfileContent() {
  const router = useRouter();
  const runtimeVendorHost =
    typeof window !== "undefined" && window.location?.host
      ? (isLocalhostLike(window.location.host.toLowerCase()) ? configuredVendorHost : window.location.host.toLowerCase())
      : configuredVendorHost;

  async function logout() {
    await fetch(`${apiBase}/v1/auth/logout`, {
      method: "POST",
      headers: { ...clientPageHeader },
      credentials: "include",
    }).catch(() => null);
    router.replace("/vendor/login");
  }

  return (
    <Container size="xl" py="lg">
      <Stack gap="md">
        <Paper withBorder radius="xl" p="md" shadow="sm">
          <Stack gap="sm">
            <Group justify="space-between" align="center" wrap="wrap">
              <Button component={Link} href="/vendor" variant="light">
                Back to Dashboard
              </Button>
              <Button onClick={() => void logout()} variant="outline">
                Logout
              </Button>
            </Group>
            <div>
              <Title order={1}>Vendor Profile</Title>
              <Text c="dimmed">Current tenant host: {runtimeVendorHost}</Text>
            </div>
          </Stack>
        </Paper>

        <VendorApplicationForm
          title="Vendor Profile"
          description="Complete your vendor application after email verification and keep your business details updated. This information is used for approval review."
          primaryActionLabel="Save Vendor Profile"
          note="Please upload your identifying document before submitting the final application."
        />
      </Stack>
    </Container>
  );
}
