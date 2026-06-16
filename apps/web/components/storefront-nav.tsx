"use client";

import Link from "next/link";
import { useDisclosure } from "@mantine/hooks";
import { Avatar, Badge, Button, Burger, Divider, Drawer, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { normalizeVendorLogoUrl } from "../lib/media-url";

export type StorefrontNavAction = {
  label: string;
  href: string;
  variant?: "filled" | "light" | "outline" | "subtle" | "default";
};

export type StorefrontNavUser = {
  displayName?: string | null;
  fullName?: string | null;
  email?: string | null;
};

type StorefrontNavProps = {
  brandName: string;
  host: string;
  logoUrl?: string | null;
  pointsLabel?: string | null;
  desktopActions: StorefrontNavAction[];
  drawerActions: StorefrontNavAction[];
  user?: StorefrontNavUser | null;
  onLogout?: () => void;
  showPoints?: boolean;
};

export function StorefrontNav({
  brandName,
  host,
  logoUrl,
  pointsLabel,
  desktopActions,
  drawerActions,
  user,
  onLogout,
  showPoints = true,
}: StorefrontNavProps) {
  const [opened, { open, close }] = useDisclosure(false);
  const hasUser = Boolean(user);
  const displayName = user?.displayName || user?.fullName || "Guest";
  const avatarInitial = displayName.slice(0, 1).toUpperCase();
  const resolvedLogo = normalizeVendorLogoUrl(logoUrl) || "/default-brand-logo.png";

  return (
    <>
      <Paper withBorder radius="xl" p="md" shadow="sm">
        <Group justify="space-between" align="center" gap="md" wrap="nowrap">
          <Group gap="sm" align="center" wrap="nowrap">
            <img
              src={resolvedLogo}
              alt="Vendor logo"
              style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 12, flexShrink: 0 }}
            />
            <Stack gap={0} style={{ minWidth: 0 }}>
              <Title order={2} size="h3">
                {brandName}
              </Title>
              <Text size="sm" c="dimmed" lineClamp={1}>
                {host}
              </Text>
            </Stack>
          </Group>

          <Group gap="xs" justify="flex-end" wrap="nowrap" visibleFrom="sm">
            {showPoints && pointsLabel ? <Badge variant="light" size="lg">{pointsLabel}</Badge> : null}
            {desktopActions.map((action) => (
              <Button key={`${action.label}-${action.href}`} component={Link} href={action.href} variant={action.variant ?? "subtle"}>
                {action.label}
              </Button>
            ))}
            {hasUser ? (
              <Paper component={Link} href="/profile" withBorder radius="md" p="sm" style={{ textDecoration: "none" }}>
                <Group gap="sm" wrap="nowrap" align="center">
                  <Avatar radius="xl" color="violet" size="sm">
                    {avatarInitial}
                  </Avatar>
                  <Stack gap={0}>
                    <Text fw={600}>{displayName}</Text>
                    <Text size="sm" c="dimmed">
                      {user?.email || ""}
                    </Text>
                  </Stack>
                </Group>
              </Paper>
            ) : (
              <>
                <Button variant="light" component={Link} href="/login">
                  Customer Login
                </Button>
                <Button variant="outline" component={Link} href="/register">
                  Customer Register
                </Button>
              </>
            )}
            {hasUser && onLogout ? <Button variant="subtle" onClick={onLogout}>Logout</Button> : null}
          </Group>

          <Group gap="xs" wrap="nowrap" hiddenFrom="sm">
            {showPoints && pointsLabel ? <Badge variant="light" size="md">{pointsLabel}</Badge> : null}
            <Burger opened={opened} onClick={opened ? close : open} aria-label="Open navigation" />
          </Group>
        </Group>
      </Paper>

      <Drawer
        opened={opened}
        onClose={close}
        title="Menu"
        position="right"
        size="sm"
        padding="md"
      >
        <Stack gap="md">
          <Paper withBorder radius="lg" p="md">
            <Group gap="sm" align="center" wrap="nowrap">
              <Avatar radius="xl" color="violet">
                {avatarInitial}
              </Avatar>
              <Stack gap={2}>
                <Text fw={700}>{displayName}</Text>
                <Text size="sm" c="dimmed">
                  {user?.email || "Sign in to manage your profile"}
                </Text>
                <Text size="xs" c="dimmed">
                  {host}
                </Text>
              </Stack>
            </Group>
          </Paper>

          {showPoints && pointsLabel ? <Badge variant="light" size="lg" fullWidth>{pointsLabel}</Badge> : null}

          {drawerActions.map((action) => (
            <Button
              key={`${action.label}-${action.href}`}
              component={Link}
              href={action.href}
              variant={action.variant ?? "light"}
              fullWidth
              onClick={close}
            >
              {action.label}
            </Button>
          ))}

          {hasUser ? (
            <>
              <Button component={Link} href="/profile" variant="outline" fullWidth onClick={close}>
                My Profile
              </Button>
              {onLogout ? (
                <Button
                  variant="subtle"
                  fullWidth
                  onClick={() => {
                    close();
                    onLogout();
                  }}
                >
                  Logout
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <Button component={Link} href="/login" variant="light" fullWidth onClick={close}>
                Customer Login
              </Button>
              <Button component={Link} href="/register" variant="outline" fullWidth onClick={close}>
                Customer Register
              </Button>
            </>
          )}

          <Divider />

          <Button component={Link} href="/fairness-proofs" variant="subtle" fullWidth onClick={close}>
            Fairness Proofs
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}
