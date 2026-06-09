"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { applyVendorFavicon } from "../../../lib/favicon";
import { normalizeVendorFaviconUrl, normalizeVendorLogoUrl } from "../../../lib/media-url";
import { useBackForwardRefresh } from "../../../lib/use-back-forward-refresh";

type WalletEntryType = "CREDIT" | "DEBIT";

type WalletEntry = {
  id: string;
  type: WalletEntryType;
  amountPoints: number;
  reason: string;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
  referenceLabel: string;
};

type Wallet = {
  id: string;
  balancePoints: number;
  entries: WalletEntry[];
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

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const clientPageHeader = { "x-client-page": "/customer/wallet" };

function formatTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatReason(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

function formatSignedPoints(entry: WalletEntry) {
  const prefix = entry.type === "CREDIT" ? "+" : "-";
  return `${prefix}${entry.amountPoints.toLocaleString()} pts`;
}

function entryDedupeKey(entry: WalletEntry) {
  if (entry.reason === "BUYBACK_CREDIT") return `buyback:${entry.referenceLabel}`;
  return entry.id;
}

function dedupeWalletEntries(entries: WalletEntry[]) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = entryDedupeKey(entry);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function CustomerWalletPage() {
  const runtimeVendorHost = useMemo(() => {
    if (typeof window !== "undefined" && window.location?.host) return window.location.host.toLowerCase();
    return configuredVendorHost;
  }, []);
  const headers = useMemo(() => ({ "x-vendor-host": runtimeVendorHost, ...clientPageHeader }), [runtimeVendorHost]);

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<VendorTheme | null>(null);
  const [vendorLogo, setVendorLogo] = useState<string | null>(null);
  const [vendorFavicon, setVendorFavicon] = useState<string | null>(null);

  const loadWallet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [walletResponse, vendorResponse] = await Promise.all([
        fetch(`${apiBase}/v1/wallet`, { headers, credentials: "include", cache: "no-store" }),
        fetch(`${apiBase}/v1/vendor/current`, { headers, credentials: "include", cache: "no-store" }),
      ]);

      const vendorPayload = vendorResponse.ok ? await vendorResponse.json().catch(() => null) : null;
      setTheme(vendorPayload?.vendor?.vendorSettings ?? null);
      setVendorLogo(normalizeVendorLogoUrl(vendorPayload?.vendor?.logoImageUrl) || null);
      setVendorFavicon(normalizeVendorFaviconUrl(vendorPayload?.vendor?.faviconImageUrl, vendorPayload?.vendor?.logoImageUrl) || null);

      const payload = await walletResponse.json().catch(() => ({}));
      if (!walletResponse.ok) throw new Error(payload.error ?? "Failed to load wallet history");
      setWallet({
        ...payload.wallet,
        entries: dedupeWalletEntries(payload.wallet?.entries ?? []),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load wallet history");
      setWallet(null);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  useBackForwardRefresh(loadWallet, { cooldownMs: 15000 });

  useEffect(() => {
    applyVendorFavicon(normalizeVendorFaviconUrl(vendorFavicon, vendorLogo));
  }, [vendorFavicon, vendorLogo]);

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

  const entries = wallet?.entries ?? [];
  const credits = entries.filter((entry) => entry.type === "CREDIT").reduce((sum, entry) => sum + entry.amountPoints, 0);
  const debits = entries.filter((entry) => entry.type === "DEBIT").reduce((sum, entry) => sum + entry.amountPoints, 0);

  return (
    <main className="container customer-wallet-page" style={storefrontThemeStyle}>
      <header className="site-header customer-items-header">
        <div className="brand-text">
          <strong>Wallet history</strong>
          <span>Balance changes, draw costs, and buyback credits.</span>
        </div>
        <div className="actions">
          <Link href="/" className="sort-pill">Catalog</Link>
          <Link href="/customer/items" className="sort-pill">My Backpack</Link>
          <Link href="/fairness-proofs" className="sort-pill">Fairness Proofs</Link>
          <button type="button" className="sort-pill" onClick={() => void loadWallet()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </header>

      <section className="card wallet-ledger-summary-card">
        <div>
          <p className="muted tiny">Customer ledger</p>
          <h1>{wallet ? `${wallet.balancePoints.toLocaleString()} pts` : "Wallet balance"}</h1>
          <p className="muted backpack-intro">Recent entries are scoped to this storefront and your signed-in customer account.</p>
        </div>
        <div className="backpack-stats wallet-ledger-stats">
          <div><strong>{entries.length}</strong><span>Recent entries</span></div>
          <div><strong>+{credits.toLocaleString()}</strong><span>Credits shown</span></div>
          <div><strong>-{debits.toLocaleString()}</strong><span>Debits shown</span></div>
        </div>
      </section>

      {error ? <p className="error">{error}</p> : null}
      {loading ? <section className="card"><p className="muted">Loading wallet history...</p></section> : null}

      {!loading && !error && wallet && entries.length === 0 ? (
        <section className="card backpack-empty-state">
          <h2>No wallet entries yet</h2>
          <p className="muted">Draw costs and buyback credits will appear here after your first wallet movement.</p>
          <Link href="/" className="draw-button link-button">Browse Packs</Link>
        </section>
      ) : null}

      {!loading && !error && entries.length > 0 ? (
        <section className="card wallet-ledger-card" aria-label="Wallet ledger entries">
          <div className="wallet-ledger-heading">
            <h2>Recent balance changes</h2>
            <p className="muted">Reference labels are customer-safe and exclude admin notes, actor IDs, and raw idempotency scopes.</p>
          </div>
          <ol className="wallet-entry-list">
            {entries.map((entry) => (
              <li className="wallet-entry-row" key={entry.id}>
                <div className={`wallet-entry-type ${entry.type === "CREDIT" ? "credit" : "debit"}`}>{entry.type.toLowerCase()}</div>
                <div className="wallet-entry-main">
                  <strong>{formatReason(entry.reason)}</strong>
                  <span>{entry.referenceLabel}</span>
                  <small>{formatTime(entry.createdAt)}</small>
                </div>
                <div className="wallet-entry-amount">
                  <strong>{formatSignedPoints(entry)}</strong>
                  <small>{entry.balanceBefore.toLocaleString()} to {entry.balanceAfter.toLocaleString()}</small>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </main>
  );
}
