"use client";

import Link from "next/link";
import { Badge, Button, Divider, Group, Paper, SimpleGrid, Stack, Text } from "@mantine/core";

type StorefrontFooterUser = {
  displayName?: string | null;
  fullName?: string | null;
  email?: string | null;
};

type StorefrontFooterProps = {
  brandName: string;
  host: string;
  user?: StorefrontFooterUser | null;
  onLogout?: () => void;
};

export function StorefrontFooter({ brandName, host, user, onLogout }: StorefrontFooterProps) {
  const shellStyle = {
    background: "color-mix(in srgb, var(--card) 90%, transparent)",
    borderColor: "color-mix(in srgb, var(--brand-soft) 72%, transparent)",
    color: "var(--text)",
    boxShadow: "0 18px 45px rgba(9, 8, 18, 0.12)",
    backdropFilter: "blur(18px)",
  } as const;

  const subtleButtonStyle = {
    background: "color-mix(in srgb, var(--brand-soft) 52%, transparent)",
    borderColor: "color-mix(in srgb, var(--brand) 28%, transparent)",
    color: "var(--text)",
  } as const;

  const solidButtonStyle = {
    background: "linear-gradient(135deg, var(--brand), var(--brand-accent))",
    borderColor: "transparent",
    color: "white",
    boxShadow: "0 10px 24px color-mix(in srgb, var(--brand) 30%, transparent)",
  } as const;

  return (
    <Paper withBorder radius="xl" p="lg" shadow="sm" mt="lg" style={shellStyle}>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
        <Stack gap={6}>
          <Text fw={800} size="lg" style={{ color: "var(--text)" }}>
            {brandName}
          </Text>
          <Text size="sm" style={{ color: "var(--muted)" }}>
            Browse live packs, check setlists, and manage your profile from a mobile-first storefront.
          </Text>
          <Badge variant="light" size="lg" w="fit-content" style={subtleButtonStyle}>
            {host}
          </Badge>
        </Stack>

        <Stack gap={8}>
          <Text fw={700} style={{ color: "var(--text)" }}>Quick links</Text>
          <Button component={Link} href="/" variant="subtle" justify="flex-start" px={0} style={subtleButtonStyle}>
            Home
          </Button>
          <Button component={Link} href="/setlists" variant="subtle" justify="flex-start" px={0} style={subtleButtonStyle}>
            Setlists
          </Button>
          <Button component={Link} href="/fairness-proofs" variant="subtle" justify="flex-start" px={0} style={subtleButtonStyle}>
            Fairness Proofs
          </Button>
          <Button component={Link} href="/profile" variant="subtle" justify="flex-start" px={0} style={subtleButtonStyle}>
            My Profile
          </Button>
        </Stack>

        <Stack gap={8}>
          <Text fw={700} style={{ color: "var(--text)" }}>Account</Text>
          {user ? (
            <>
              <Text size="sm" style={{ color: "var(--muted)" }}>
                {user.displayName || user.fullName || "Customer"}
              </Text>
              <Text size="sm" style={{ color: "var(--muted)" }}>
                {user.email}
              </Text>
              {onLogout ? (
                <Button variant="filled" onClick={onLogout} fullWidth style={solidButtonStyle}>
                  Logout
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <Button component={Link} href="/login" variant="filled" fullWidth style={solidButtonStyle}>
                Customer Login
              </Button>
              <Button component={Link} href="/register" variant="outline" fullWidth style={subtleButtonStyle}>
                Customer Register
              </Button>
            </>
          )}
        </Stack>
      </SimpleGrid>

      <Divider my="lg" />

      <Group justify="space-between" align="center" gap="md" wrap="wrap">
        <Text size="sm" style={{ color: "var(--muted)" }}>
          Powered by Oripa. {new Date().getFullYear()}.
        </Text>
        <Text size="sm" style={{ color: "var(--muted)" }}>
          Theme, navigation, buttons, and account actions inherit this vendor storefront.
        </Text>
      </Group>
    </Paper>
  );
}
