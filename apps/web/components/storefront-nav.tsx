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
  const shellStyle = {
    background: "color-mix(in srgb, var(--card) 88%, transparent)",
    borderColor: "color-mix(in srgb, var(--brand-soft) 72%, transparent)",
    boxShadow: "0 18px 45px rgba(9, 8, 18, 0.14)",
    color: "var(--text)",
    backdropFilter: "blur(18px)",
  } as const;

  const subtleButtonStyle = {
    background: "color-mix(in srgb, var(--brand-soft) 58%, transparent)",
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
    <>
      <Paper withBorder radius="xl" p="md" shadow="sm" style={shellStyle}>
        <Group justify="space-between" align="center" gap="md" wrap="nowrap">
          <Group gap="sm" align="center" wrap="nowrap">
            <img
              src={resolvedLogo}
              alt="Vendor logo"
              style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 12, flexShrink: 0 }}
            />
            <Stack gap={0} style={{ minWidth: 0 }}>
              <Title order={2} size="h3" c="var(--text)">
                {brandName}
              </Title>
              <Text size="sm" style={{ color: "var(--muted)" }} lineClamp={1}>
                {host}
              </Text>
            </Stack>
          </Group>

          <Group gap="xs" justify="flex-end" wrap="nowrap" visibleFrom="sm">
            {showPoints && pointsLabel ? (
              <Badge variant="light" size="lg" style={subtleButtonStyle}>
                {pointsLabel}
              </Badge>
            ) : null}
            {desktopActions.map((action) => (
              <Button
                key={`${action.label}-${action.href}`}
                component={Link}
                href={action.href}
                variant={action.variant ?? "subtle"}
                style={action.variant === "filled" ? solidButtonStyle : subtleButtonStyle}
              >
                {action.label}
              </Button>
            ))}
            {hasUser ? (
              <Paper
                component={Link}
                href="/profile"
                withBorder
                radius="md"
                p="sm"
                style={{
                  textDecoration: "none",
                  background: "color-mix(in srgb, var(--brand-soft) 40%, var(--card))",
                  borderColor: "color-mix(in srgb, var(--brand-soft) 72%, transparent)",
                  color: "var(--text)",
                }}
              >
                <Group gap="sm" wrap="nowrap" align="center">
                  <Avatar radius="xl" size="sm" style={{ background: "var(--brand)", color: "white" }}>
                    {avatarInitial}
                  </Avatar>
                  <Stack gap={0}>
                    <Text fw={600} style={{ color: "var(--text)" }}>
                      {displayName}
                    </Text>
                    <Text size="sm" style={{ color: "var(--muted)" }}>
                      {user?.email || ""}
                    </Text>
                  </Stack>
                </Group>
              </Paper>
            ) : (
              <>
                <Button component={Link} href="/login" variant="filled" style={solidButtonStyle}>
                  Customer Login
                </Button>
                <Button component={Link} href="/register" variant="outline" style={subtleButtonStyle}>
                  Customer Register
                </Button>
              </>
            )}
            {hasUser && onLogout ? (
              <Button variant="outline" onClick={onLogout} style={subtleButtonStyle}>
                Logout
              </Button>
            ) : null}
          </Group>

          <Group gap="xs" wrap="nowrap" hiddenFrom="sm">
            {showPoints && pointsLabel ? (
              <Badge variant="light" size="md" style={subtleButtonStyle}>
                {pointsLabel}
              </Badge>
            ) : null}
            <Burger
              opened={opened}
              onClick={opened ? close : open}
              aria-label="Open navigation"
              color="var(--brand)"
              style={{ color: "var(--brand)" }}
            />
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
        styles={{
          content: {
            background: "var(--card)",
            color: "var(--text)",
          },
          header: {
            background: "var(--card)",
            color: "var(--text)",
          },
        }}
      >
        <Stack gap="md">
          <Paper
            withBorder
            radius="lg"
            p="md"
            style={{
              background: "color-mix(in srgb, var(--brand-soft) 34%, var(--card))",
              borderColor: "color-mix(in srgb, var(--brand-soft) 72%, transparent)",
            }}
          >
            <Group gap="sm" align="center" wrap="nowrap">
              <Avatar radius="xl" style={{ background: "var(--brand)", color: "white" }}>
                {avatarInitial}
              </Avatar>
              <Stack gap={2}>
                <Text fw={700} style={{ color: "var(--text)" }}>
                  {displayName}
                </Text>
                <Text size="sm" style={{ color: "var(--muted)" }}>
                  {user?.email || "Sign in to manage your profile"}
                </Text>
                <Text size="xs" style={{ color: "var(--muted)" }}>
                  {host}
                </Text>
              </Stack>
            </Group>
          </Paper>

          {showPoints && pointsLabel ? (
            <Badge variant="light" size="lg" fullWidth style={subtleButtonStyle}>
              {pointsLabel}
            </Badge>
          ) : null}

          {drawerActions.map((action) => (
            <Button
              key={`${action.label}-${action.href}`}
              component={Link}
              href={action.href}
              variant={action.variant ?? "light"}
              fullWidth
              onClick={close}
              style={action.variant === "filled" ? solidButtonStyle : subtleButtonStyle}
            >
              {action.label}
            </Button>
          ))}

          {hasUser ? (
            <>
              <Button component={Link} href="/profile" variant="outline" fullWidth onClick={close} style={subtleButtonStyle}>
                My Profile
              </Button>
              {onLogout ? (
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => {
                    close();
                    onLogout();
                  }}
                  style={subtleButtonStyle}
                >
                  Logout
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <Button component={Link} href="/login" variant="filled" fullWidth onClick={close} style={solidButtonStyle}>
                Customer Login
              </Button>
              <Button component={Link} href="/register" variant="outline" fullWidth onClick={close} style={subtleButtonStyle}>
                Customer Register
              </Button>
            </>
          )}

          <Divider />

          <Button component={Link} href="/fairness-proofs" variant="subtle" fullWidth onClick={close} style={subtleButtonStyle}>
            Fairness Proofs
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}
