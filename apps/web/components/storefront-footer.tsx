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
  return (
    <Paper withBorder radius="xl" p="lg" shadow="sm" mt="lg">
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
        <Stack gap={6}>
          <Text fw={800} size="lg">
            {brandName}
          </Text>
          <Text c="dimmed" size="sm">
            Browse live packs, check setlists, and manage your profile from a mobile-first storefront.
          </Text>
          <Badge variant="light" size="lg" w="fit-content">
            {host}
          </Badge>
        </Stack>

        <Stack gap={8}>
          <Text fw={700}>Quick links</Text>
          <Button component={Link} href="/" variant="subtle" justify="flex-start" px={0}>
            Home
          </Button>
          <Button component={Link} href="/setlists" variant="subtle" justify="flex-start" px={0}>
            Setlists
          </Button>
          <Button component={Link} href="/fairness-proofs" variant="subtle" justify="flex-start" px={0}>
            Fairness Proofs
          </Button>
          <Button component={Link} href="/profile" variant="subtle" justify="flex-start" px={0}>
            My Profile
          </Button>
        </Stack>

        <Stack gap={8}>
          <Text fw={700}>Account</Text>
          {user ? (
            <>
              <Text size="sm" c="dimmed">
                {user.displayName || user.fullName || "Customer"}
              </Text>
              <Text size="sm" c="dimmed">
                {user.email}
              </Text>
              {onLogout ? (
                <Button variant="light" onClick={onLogout} fullWidth>
                  Logout
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <Button component={Link} href="/login" variant="light" fullWidth>
                Customer Login
              </Button>
              <Button component={Link} href="/register" variant="outline" fullWidth>
                Customer Register
              </Button>
            </>
          )}
        </Stack>
      </SimpleGrid>

      <Divider my="lg" />

      <Group justify="space-between" align="center" gap="md" wrap="wrap">
        <Text size="sm" c="dimmed">
          Powered by Oripa. {new Date().getFullYear()}.
        </Text>
        <Text size="sm" c="dimmed">
          Theme, navigation, buttons, and account actions inherit this vendor storefront.
        </Text>
      </Group>
    </Paper>
  );
}
