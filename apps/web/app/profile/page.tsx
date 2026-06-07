"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { FormField } from "../../components/form-field";
import { COUNTRY_OPTIONS } from "../../lib/countries";
import { applyVendorFavicon } from "../../lib/favicon";
import { normalizeVendorFaviconUrl, normalizeVendorLogoUrl } from "../../lib/media-url";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const clientPageHeader = { "x-client-page": "/profile" };

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
      headers: { "x-vendor-host": runtimeVendorHost, ...clientPageHeader },
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

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
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

  return (
    <main className="container" style={storefrontThemeStyle}>
      <header className="auth-top-nav profile-top-nav">
        <Link href="/" className="sort-pill">Back to Home</Link>
        <Link href="/vendor" className="sort-pill">Vendor Dashboard</Link>
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

        {user?.profileComplete ? (
          <p className="muted" style={{ marginTop: 14 }}>
            Ready to continue? <Link href="/">Return to storefront</Link>
          </p>
        ) : null}
      </section>
    </main>
  );
}
