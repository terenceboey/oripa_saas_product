"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import type { CSSProperties } from "react";
import { AirwallexDropInCheckout } from "../../components/airwallex-dropin-checkout";
import { FormField } from "../../components/form-field";
import { COUNTRY_OPTIONS } from "../../lib/countries";
import { formatCurrencyAmount, resolveCurrencyCodeForCountry } from "../../lib/airwallex";
import { applyVendorFavicon } from "../../lib/favicon";
import { normalizeVendorFaviconUrl, normalizeVendorLogoUrl } from "../../lib/media-url";

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
  status: string;
  profileComplete: boolean;
};

type VendorTheme = {
  storefrontPrimary: string;
  storefrontSecondary: string;
  storefrontAccent: string;
  storefrontSurface: string;
  storefrontText: string;
  storefrontMuted: string;
  storefrontRadius: number;
};

type VendorBranding = {
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
    createdAt: string;
  }>;
  topupOrders: WalletTopupOrder[];
  drawOrders: WalletDrawOrder[];
};

export default function CustomerProfilePage() {
  return (
    <Suspense fallback={<main className="container"><section className="card auth-card"><p className="muted">Loading profile...</p></section></main>}>
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

  const storefrontThemeStyle = useMemo(() => {
    if (!theme) return undefined;
    return {
      ["--brand" as string]: theme.storefrontPrimary,
      ["--card" as string]: theme.storefrontSurface,
      ["--text" as string]: theme.storefrontText,
      ["--muted" as string]: theme.storefrontMuted,
      ["--border" as string]: theme.storefrontSecondary,
      ["--brand-soft" as string]: theme.storefrontSecondary,
      ["--brand-accent" as string]: theme.storefrontAccent,
      ["--radius-lg" as string]: `${theme.storefrontRadius}px`,
    } as CSSProperties;
  }, [theme]);

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
    <main className="container" style={storefrontThemeStyle}>
      <header className="auth-top-nav profile-top-nav">
        <Link href="/" className="sort-pill">Back to Home</Link>
        {user ? (
          <button type="button" className="sort-pill" onClick={() => void logout()}>
            Logout
          </button>
        ) : null}
      </header>

      <section className="card auth-card">
        <h1>Customer Profile</h1>
        <p className="muted">
          Complete your customer information so account, wallet, and future checkout flows have the details they need.
        </p>

        {loading ? <p className="muted">Loading profile...</p> : null}
        {!loading && !user ? (
          <p className="muted">
            {error ?? "Please log in to complete your profile."} <Link href="/login">Go to login</Link>
          </p>
        ) : null}

        {user ? (
          <>
            <div className="auth-profile-card">
              <strong>{user.profileComplete ? "Profile complete" : "Profile incomplete"}</strong>
              <div className="muted tiny">{user.email}</div>
            </div>

            <form className="auth-form" onSubmit={saveProfile}>
              <FormField label="Full name">
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" autoComplete="name" required />
              </FormField>
              <FormField label="Date of birth">
                <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required />
              </FormField>
              <FormField label="Country">
                <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} required>
                  <option value="">Select country</option>
                  {COUNTRY_OPTIONS.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <button type="submit" className="draw-button" disabled={saving}>
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </form>
          </>
        ) : null}

        {error && user ? <p className="error">{error}</p> : null}
        {message ? <p className="badge">{message}</p> : null}

        {user ? (
          <section className="card" style={{ marginTop: 18 }}>
            <div className="heading-row">
              <h2>Points Wallet</h2>
              <span className="muted tiny">Storefront balance for this vendor</span>
            </div>

            <div className="stats-grid" style={{ marginTop: 10 }}>
              <div className="stat">
                <div className="stat-label">Current balance</div>
                <div className="stat-value">{walletLoading ? "..." : formatPoints(wallet?.balancePoints ?? 0)}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Top-ups</div>
                <div className="stat-value">{wallet?.topupOrders?.length ?? 0}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Spends</div>
                <div className="stat-value">{wallet?.drawOrders?.length ?? 0}</div>
              </div>
            </div>

            <p className="muted tiny" style={{ marginTop: 8 }}>
              Top-ups are processed through Airwallex sandbox. Your amount is charged in your local currency at a fixed rate of {topupPointsPerCurrencyUnit} points = 1 {customerCurrencyCode}.
            </p>

            <div className="actions" style={{ marginTop: 12 }}>
              {fixedTopupAmounts.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className={`sort-pill ${topupAmount === String(amount) ? "active" : ""}`}
                  disabled={topupSaving}
                  onClick={() => {
                    setTopupAmount(String(amount));
                    void submitTopup(amount);
                  }}
                >
                  +{formatPoints(amount)} pts ({formatTopupCharge(amount)})
                </button>
              ))}
            </div>

            <form className="auth-form" onSubmit={submitCustomTopup} style={{ marginTop: 12 }}>
              <FormField label="Custom top-up amount">
                <input
                  type="number"
                  min={1}
                  max={100000}
                  value={customTopupAmount}
                  onChange={(e) => setCustomTopupAmount(e.target.value)}
                  placeholder="Enter custom points amount"
                />
                <div className="muted tiny" style={{ marginTop: 6 }}>
                  Estimated charge: {formatTopupCharge(Number(customTopupAmount) || 0)}
                </div>
              </FormField>
              <button type="submit" className="draw-button" disabled={topupSaving}>
                {topupSaving ? "Top-up..." : "Top up custom amount"}
              </button>
            </form>

            {walletMessage ? <p className="badge" style={{ marginTop: 10 }}>{walletMessage}</p> : null}
            {walletError ? <p className="error">{walletError}</p> : null}

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

            <div style={{ marginTop: 16 }}>
              <h3>Purchase history</h3>
              <div className="result-list">
                {wallet?.topupOrders?.length ? wallet.topupOrders.map((topup) => (
                  <div className="result-row" key={topup.id}>
                    <span>
                      {formatPoints(topup.pointsToCredit)} pts {topup.status}{" "}
                      {topup.expectedCurrencyAmount !== null && topup.expectedCurrencyAmount !== undefined
                        ? `(${formatCurrencyAmount(Number(topup.expectedCurrencyAmount ?? 0), topup.currencyCode ?? customerCurrencyCode)})`
                        : ""}
                    </span>
                    <span className="muted tiny">
                      {topup.createdAt ? new Date(topup.createdAt).toLocaleString() : ""}
                    </span>
                  </div>
                )) : <p className="muted tiny">No top-up history yet.</p>}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <h3>Spending history</h3>
              <div className="result-list">
                {wallet?.drawOrders?.length ? wallet.drawOrders.map((draw) => (
                  <div className="result-row" key={draw.id}>
                    <span>
                      {draw.packTitle} x{draw.quantity}
                    </span>
                    <span>{formatPoints(draw.totalPoints)} pts</span>
                  </div>
                )) : <p className="muted tiny">No spending history yet.</p>}
              </div>
            </div>
          </section>
        ) : null}

        {user?.profileComplete ? (
          <p className="muted" style={{ marginTop: 14 }}>
            Ready to continue? <Link href="/">Return to storefront</Link>
          </p>
        ) : null}
      </section>
    </main>
  );
}
