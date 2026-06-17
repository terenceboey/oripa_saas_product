"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import { Alert, Anchor, Badge, Button, Container, Group, Paper, Select, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import { StorefrontFooter } from "../../components/storefront-footer";
import { AirwallexDropInCheckout } from "../../components/airwallex-dropin-checkout";
import { COUNTRY_OPTIONS } from "../../lib/countries";
import { formatCurrencyAmount, resolveCurrencyCodeForCountry } from "../../lib/airwallex";
import { applyVendorFavicon } from "../../lib/favicon";
import { normalizeVendorFaviconUrl, normalizeVendorLogoUrl } from "../../lib/media-url";
import { buildVendorCssVariables, VendorThemeProvider } from "../../lib/vendor-theme";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const clientPageHeader = { "x-client-page": "/profile" };
const fixedTopupAmounts = [500, 1000, 5000, 10000] as const;

type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  fullName: string | null;
  dateOfBirth: string | null;
  countryCode: string | null;
  phoneNumber: string | null;
  shippingAddressLine1: string | null;
  shippingAddressLine2: string | null;
  shippingAddressCity: string | null;
  shippingAddressState: string | null;
  shippingAddressPostalCode: string | null;
  shippingAddressCountry: string | null;
  status: string;
  profileComplete: boolean;
  shippingComplete: boolean;
};

type VendorTheme = {
  storefrontThemePreset?: string | null;
  storefrontPrimary: string;
  storefrontSecondary: string;
  storefrontAccent: string;
  storefrontSurface: string;
  storefrontText: string;
  storefrontMuted: string;
  storefrontRadius: number;
};

type VendorBranding = {
  name?: string | null;
  logoImageUrl?: string | null;
  faviconImageUrl?: string | null;
};

type WalletTopupOrder = {
  id: string;
  pointsToCredit: number;
  expectedCurrencyAmount: number | null;
  currencyCode: string | null;
  status: string;
  provider: string | null;
  createdAt: string;
  updatedAt: string;
};

type WalletTopupCheckout = {
  intentId: string;
  clientSecret: string;
  currencyCode: string;
  countryCode?: string | null;
  amountMajor: number;
  amountCurrency: number;
  returnUrl: string;
  successUrl: string;
  cancelUrl: string;
};

type WalletDrawOrder = {
  id: string;
  packId: string;
  packTitle: string;
  quantity: number;
  totalPoints: number;
  status: string;
  createdAt: string;
};

type WalletState = {
  id: string;
  ownerLabel: string;
  balancePoints: number;
  entries: Array<{
    id: string;
    type: "CREDIT" | "DEBIT";
    amountPoints: number;
    reason: string;
    balanceBefore: number;
    balanceAfter: number;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
  topupOrders: WalletTopupOrder[];
  drawOrders: WalletDrawOrder[];
};

export default function CustomerProfilePage() {
  return (
    <Suspense fallback={<Container size="md" py="xl"><Paper withBorder radius="xl" p="xl" shadow="sm"><Text c="dimmed">Loading profile...</Text></Paper></Container>}>
      <CustomerProfileContent />
    </Suspense>
  );
}

function CustomerProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runtimeVendorHost = useMemo(() => {
    const queryHost = String(searchParams.get("vendorHost") ?? "").trim().toLowerCase();
    if (queryHost) return queryHost;
    if (typeof window !== "undefined" && window.location?.host) return window.location.host.toLowerCase();
    return configuredVendorHost;
  }, [searchParams]);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [shippingAddressLine1, setShippingAddressLine1] = useState("");
  const [shippingAddressLine2, setShippingAddressLine2] = useState("");
  const [shippingAddressCity, setShippingAddressCity] = useState("");
  const [shippingAddressState, setShippingAddressState] = useState("");
  const [shippingAddressPostalCode, setShippingAddressPostalCode] = useState("");
  const [shippingAddressCountry, setShippingAddressCountry] = useState("");
  const [theme, setTheme] = useState<VendorTheme | null>(null);
  const [branding, setBranding] = useState<VendorBranding | null>(null);
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletLoading, setWalletLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [topupSaving, setTopupSaving] = useState(false);
  const [topupAmount, setTopupAmount] = useState("1000");
  const [customTopupAmount, setCustomTopupAmount] = useState("");
  const [topupCheckout, setTopupCheckout] = useState<WalletTopupCheckout | null>(null);
  const [topupPointsPerCurrencyUnit, setTopupPointsPerCurrencyUnit] = useState(100);
  const [walletRefreshNonce, setWalletRefreshNonce] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [walletMessage, setWalletMessage] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const customerCurrencyCode = useMemo(() => resolveCurrencyCodeForCountry(user?.countryCode ?? null, "USD"), [user?.countryCode]);
  const topupHistoryEntries = useMemo(() => {
    return (wallet?.entries ?? []).filter((entry) => entry.type === "CREDIT" && entry.reason === "WALLET_TOPUP");
  }, [wallet?.entries]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void fetch(`${apiBase}/v1/auth/profile`, {
      headers: clientPageHeader,
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? "Please log in to complete your profile.");
        return payload.user as AuthUser;
      })
      .then((nextUser) => {
        if (!active) return;
        setUser(nextUser);
        setFullName(nextUser.fullName ?? nextUser.displayName ?? "");
        setDateOfBirth(nextUser.dateOfBirth ?? "");
        setCountryCode(nextUser.countryCode ?? "");
        setPhoneNumber(nextUser.phoneNumber ?? "");
        setShippingAddressLine1(nextUser.shippingAddressLine1 ?? "");
        setShippingAddressLine2(nextUser.shippingAddressLine2 ?? "");
        setShippingAddressCity(nextUser.shippingAddressCity ?? "");
        setShippingAddressState(nextUser.shippingAddressState ?? "");
        setShippingAddressPostalCode(nextUser.shippingAddressPostalCode ?? "");
        setShippingAddressCountry(nextUser.shippingAddressCountry ?? "");
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Please log in to complete your profile.");
        setUser(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    void fetch(`${apiBase}/v1/vendor/current`, {
      headers: { ...clientPageHeader },
      credentials: "include",
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!active) return;
        setTheme(payload?.vendor?.vendorSettings ?? null);
        setBranding({
          name: payload?.vendor?.name ?? null,
          logoImageUrl: normalizeVendorLogoUrl(payload?.vendor?.logoImageUrl) || null,
          faviconImageUrl: normalizeVendorFaviconUrl(payload?.vendor?.faviconImageUrl, payload?.vendor?.logoImageUrl) || null,
        });
      })
      .catch(() => null);

    return () => {
      active = false;
    };
  }, [runtimeVendorHost]);

  useEffect(() => {
    let active = true;

    if (!user) {
      setWallet(null);
      setWalletLoading(false);
      return () => {
        active = false;
      };
    }

    setWalletLoading(true);
    setWalletError(null);

    void fetch(`${apiBase}/v1/wallet`, {
      headers: clientPageHeader,
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? "Failed to load wallet.");
        return payload.wallet as WalletState;
      })
      .then((nextWallet) => {
        if (!active) return;
        setWallet(nextWallet ?? null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setWallet(null);
        setWalletError(err instanceof Error ? err.message : "Failed to load wallet.");
      })
      .finally(() => {
        if (!active) return;
        setWalletLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user, runtimeVendorHost, walletRefreshNonce]);

  const storefrontThemeStyle = useMemo(() => buildVendorCssVariables(theme), [theme]);

  useEffect(() => {
    applyVendorFavicon(normalizeVendorFaviconUrl(branding?.faviconImageUrl, branding?.logoImageUrl));
  }, [branding?.faviconImageUrl, branding?.logoImageUrl]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`${apiBase}/v1/auth/profile`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...clientPageHeader,
        },
        credentials: "include",
        body: JSON.stringify({ fullName, displayName: fullName, dateOfBirth, countryCode }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const issues = Array.isArray(payload.issues) ? ` ${payload.issues.join(", ")}` : "";
        throw new Error(`${payload.error ?? "Failed to save profile."}${issues}`);
      }
      setUser(payload.user ?? null);
      setMessage("Profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function saveShippingDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`${apiBase}/v1/auth/profile/shipping`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...clientPageHeader,
        },
        credentials: "include",
        body: JSON.stringify({
          phoneNumber,
          shippingAddressLine1,
          shippingAddressLine2,
          shippingAddressCity,
          shippingAddressState,
          shippingAddressPostalCode,
          shippingAddressCountry,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const issues = Array.isArray(payload.issues) ? ` ${payload.issues.join(", ")}` : "";
        throw new Error(`${payload.error ?? "Failed to save shipping details."}${issues}`);
      }
      setUser(payload.user ?? null);
      setMessage("Shipping details saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save shipping details.");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch(`${apiBase}/v1/auth/logout`, {
      method: "POST",
      headers: clientPageHeader,
      credentials: "include",
      cache: "no-store",
    }).catch(() => null);
    router.replace("/login");
  }

  function formatPoints(value: number) {
    return value.toLocaleString();
  }

  function formatTopupCharge(amountPoints: number) {
    return formatCurrencyAmount(amountPoints / topupPointsPerCurrencyUnit, customerCurrencyCode);
  }

  function handleCheckoutSuccess() {
    setWalletMessage("Payment received. Waiting for wallet confirmation...");
    window.setTimeout(() => {
      setWalletRefreshNonce((value) => value + 1);
    }, 2500);
  }

  async function submitTopup(amountPoints: number) {
    if (!user) return;
    setTopupSaving(true);
    setWalletMessage(null);
    setWalletError(null);

    const idempotencyKey = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

    try {
      const response = await fetch(`${apiBase}/v1/wallet/topups`, {
        method: "POST",
        headers: {
          ...clientPageHeader,
          "content-type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        credentials: "include",
        body: JSON.stringify({ amountPoints }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to top up points.");
      }
      setWallet(payload.wallet ?? null);
      setTopupPointsPerCurrencyUnit(Number(payload.pricing?.pointsPerCurrencyUnit ?? 100));
      if (!payload.checkout?.intentId || !payload.checkout?.clientSecret || !payload.checkout?.currencyCode) {
        throw new Error("Checkout session was not created.");
      }
      setTopupCheckout({
        intentId: payload.checkout.intentId,
        clientSecret: payload.checkout.clientSecret,
        currencyCode: payload.checkout.currencyCode,
        countryCode: payload.checkout.countryCode ?? user.countryCode ?? null,
        amountMajor: Number(payload.checkout.amountMajor ?? payload.checkout.amountCurrency ?? 0),
        amountCurrency: Number(payload.checkout.amountCurrency ?? 0),
        returnUrl: String(payload.checkout.returnUrl ?? window.location.href),
        successUrl: String(payload.checkout.successUrl ?? window.location.href),
        cancelUrl: String(payload.checkout.cancelUrl ?? window.location.href),
      });
      setWalletMessage("Complete the payment below.");
      setCustomTopupAmount("");
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : "Failed to top up points.");
    } finally {
      setTopupSaving(false);
    }
  }

  async function submitCustomTopup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(customTopupAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      setWalletError("Enter a valid custom top-up amount.");
      return;
    }
    await submitTopup(amount);
  }

  return (
    <VendorThemeProvider theme={theme}>
      <Container size="md" py="xl" style={storefrontThemeStyle}>
        <Paper radius="xl" p="xl" shadow="md" withBorder>
        <Group justify="space-between" mb="xl">
          <Button component={Link} href="/" variant="light" radius="md">
            Back to Home
          </Button>
          {user ? (
            <Button variant="subtle" onClick={() => void logout()} radius="md">
              Logout
            </Button>
          ) : null}
        </Group>

        <Stack gap="lg">
          <div>
            <Title order={1}>Customer Profile</Title>
            <Text c="dimmed" mt={6}>
              Complete your customer information so account, wallet, and future checkout flows have the details they need.
            </Text>
          </div>

          {loading ? <Text c="dimmed">Loading profile...</Text> : null}
          {!loading && !user ? (
            <Alert color="yellow" title="Login required">
              {error ?? "Please log in to complete your profile."} <Anchor component={Link} href="/login">Go to login</Anchor>
            </Alert>
          ) : null}

          {user ? (
            <>
              <Paper withBorder radius="lg" p="md">
                <Stack gap={4}>
                  <Text fw={700}>{user.profileComplete ? "Profile complete" : "Profile incomplete"}</Text>
                  <Text size="sm" c="dimmed">{user.email}</Text>
                  <Badge variant="light">{user.shippingComplete ? "Shipping details on file" : "Shipping details missing"}</Badge>
                </Stack>
              </Paper>

              <form onSubmit={saveProfile}>
                <Stack gap="md">
                  <TextInput label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" autoComplete="name" required />
                  <TextInput label="Date of birth" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required />
                  <Select
                    label="Country"
                    value={countryCode}
                    onChange={(value) => setCountryCode(value ?? "")}
                    data={COUNTRY_OPTIONS.map((country) => ({ value: country.code, label: country.name }))}
                    searchable
                    required
                  />
                  <Button type="submit" loading={saving} radius="md">
                    Save Profile
                  </Button>
                </Stack>
              </form>

              <Paper withBorder radius="lg" p="lg">
                <Stack gap="sm">
                  <div>
                    <Title order={2} size="h3">Shipping / Fulfilment Details</Title>
                    <Text c="dimmed" size="sm">
                      These details are shown to vendors after a win so they can arrange shipping or fulfilment.
                    </Text>
                  </div>
                  <form onSubmit={saveShippingDetails}>
                    <Stack gap="md">
                      <TextInput label="Phone number" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Phone number" autoComplete="tel" required />
                      <TextInput label="Address line 1" value={shippingAddressLine1} onChange={(e) => setShippingAddressLine1(e.target.value)} placeholder="Street address" autoComplete="address-line1" required />
                      <TextInput label="Address line 2" value={shippingAddressLine2} onChange={(e) => setShippingAddressLine2(e.target.value)} placeholder="Apartment, unit, building, floor" autoComplete="address-line2" />
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                        <TextInput label="City" value={shippingAddressCity} onChange={(e) => setShippingAddressCity(e.target.value)} placeholder="City" autoComplete="address-level2" required />
                        <TextInput label="State / Province" value={shippingAddressState} onChange={(e) => setShippingAddressState(e.target.value)} placeholder="State / Province" autoComplete="address-level1" />
                      </SimpleGrid>
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                        <TextInput label="Postal code" value={shippingAddressPostalCode} onChange={(e) => setShippingAddressPostalCode(e.target.value)} placeholder="Postal code" autoComplete="postal-code" required />
                        <Select
                          label="Country"
                          value={shippingAddressCountry}
                          onChange={(value) => setShippingAddressCountry(value ?? "")}
                          data={COUNTRY_OPTIONS.map((country) => ({ value: country.code, label: country.name }))}
                          searchable
                          required
                        />
                      </SimpleGrid>
                      <Button type="submit" loading={saving} radius="md">
                        Save Shipping Details
                      </Button>
                    </Stack>
                  </form>
                </Stack>
              </Paper>
            </>
          ) : null}

          {error && user ? <Alert color="red" title="Profile error">{error}</Alert> : null}
          {message ? <Alert color="green" title="Status">{message}</Alert> : null}

          {user ? (
            <Paper withBorder radius="lg" p="lg">
              <Stack gap="md">
                <Group justify="space-between">
                  <Title order={2} size="h3">Points Wallet</Title>
                  <Text c="dimmed" size="sm">Storefront balance for this vendor</Text>
                </Group>

                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                  <Paper withBorder p="md" radius="lg">
                    <Text size="sm" c="dimmed">Current balance</Text>
                    <Text fw={700} size="xl">{walletLoading ? "..." : formatPoints(wallet?.balancePoints ?? 0)}</Text>
                  </Paper>
                  <Paper withBorder p="md" radius="lg">
                    <Text size="sm" c="dimmed">Top-ups</Text>
                    <Text fw={700} size="xl">{topupHistoryEntries.length}</Text>
                  </Paper>
                  <Paper withBorder p="md" radius="lg">
                    <Text size="sm" c="dimmed">Spends</Text>
                    <Text fw={700} size="xl">{wallet?.drawOrders?.length ?? 0}</Text>
                  </Paper>
                </SimpleGrid>

                <Text c="dimmed" size="sm">
                  Top-ups are processed through Airwallex sandbox. Your amount is charged in your local currency at a fixed rate of {topupPointsPerCurrencyUnit} points = 1 {customerCurrencyCode}.
                </Text>

                <Group>
                  {fixedTopupAmounts.map((amount) => (
                    <Button
                      key={amount}
                      variant={topupAmount === String(amount) ? "filled" : "light"}
                      disabled={topupSaving}
                      onClick={() => {
                        setTopupAmount(String(amount));
                        void submitTopup(amount);
                      }}
                      radius="md"
                    >
                      +{formatPoints(amount)} pts ({formatTopupCharge(amount)})
                    </Button>
                  ))}
                </Group>

                <form onSubmit={submitCustomTopup}>
                  <Stack gap="md">
                    <TextInput
                      label="Custom top-up amount"
                      type="number"
                      min={1}
                      max={100000}
                      value={customTopupAmount}
                      onChange={(e) => setCustomTopupAmount(e.target.value)}
                      placeholder="Enter custom points amount"
                    />
                    <Text c="dimmed" size="sm">
                      Estimated charge: {formatTopupCharge(Number(customTopupAmount) || 0)}
                    </Text>
                    <Button type="submit" loading={topupSaving} radius="md">
                      Top up custom amount
                    </Button>
                  </Stack>
                </form>

                {walletMessage ? <Alert color="green" title="Wallet">{walletMessage}</Alert> : null}
                {walletError ? <Alert color="red" title="Wallet error">{walletError}</Alert> : null}

                {topupCheckout ? (
                  <AirwallexDropInCheckout
                    containerId="airwallex-dropin-checkout"
                    intentId={topupCheckout.intentId}
                    clientSecret={topupCheckout.clientSecret}
                    currencyCode={topupCheckout.currencyCode}
                    countryCode={topupCheckout.countryCode ?? user.countryCode ?? null}
                    onSuccess={handleCheckoutSuccess}
                    onError={(nextError) => setWalletError(nextError)}
                  />
                ) : null}

                <div>
                  <Title order={3} size="h4">Purchase history</Title>
                  <Stack gap="xs" mt="sm">
                    {topupHistoryEntries.length ? topupHistoryEntries.map((entry) => {
                      const entryMetadata = entry.metadata as { currencyCode?: string | null; amountCurrency?: number | string | null } | null;
                      const entryCurrencyCode = entryMetadata?.currencyCode ?? customerCurrencyCode;
                      const entryAmountCurrency = Number(entryMetadata?.amountCurrency ?? 0);
                      return (
                        <Paper key={entry.id} withBorder radius="md" p="sm">
                          <Group justify="space-between">
                            <Text size="sm">
                              {formatPoints(entry.amountPoints)} pts purchased{" "}
                              {entryAmountCurrency ? `(${formatCurrencyAmount(entryAmountCurrency, entryCurrencyCode)})` : ""}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ""}
                            </Text>
                          </Group>
                        </Paper>
                      );
                    }) : <Text c="dimmed" size="sm">No top-up history yet.</Text>}
                  </Stack>
                </div>

                <div>
                  <Title order={3} size="h4">Spending history</Title>
                  <Stack gap="xs" mt="sm">
                    {wallet?.drawOrders?.length ? wallet.drawOrders.map((draw) => (
                      <Paper key={draw.id} withBorder radius="md" p="sm">
                        <Group justify="space-between">
                          <Text size="sm">{draw.packTitle} x{draw.quantity}</Text>
                          <Text size="sm">{formatPoints(draw.totalPoints)} pts</Text>
                        </Group>
                      </Paper>
                    )) : <Text c="dimmed" size="sm">No spending history yet.</Text>}
                  </Stack>
                </div>
              </Stack>
            </Paper>
          ) : null}

          {user?.profileComplete ? (
            <Text c="dimmed">
              Ready to continue? <Anchor component={Link} href="/">Return to storefront</Anchor>
            </Text>
          ) : null}
        </Stack>
        </Paper>
        <StorefrontFooter brandName={branding?.name ?? "Storefront"} host={runtimeVendorHost} user={user} onLogout={user ? logout : undefined} />
      </Container>
    </VendorThemeProvider>
  );
}
