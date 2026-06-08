"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { FormField } from "../../components/form-field";
import { applyVendorFavicon } from "../../lib/favicon";
import { normalizeVendorFaviconUrl, normalizeVendorLogoUrl } from "../../lib/media-url";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const clientPageHeader = { "x-client-page": "/register" };
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

export default function RegisterPage() {
  const router = useRouter();
  const runtimeVendorHost = useMemo(() => {
    if (typeof window !== "undefined" && window.location?.host) return window.location.host.toLowerCase();
    return configuredVendorHost;
  }, []);
  const [referralCode, setReferralCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [theme, setTheme] = useState<VendorTheme | null>(null);
  const [branding, setBranding] = useState<VendorBranding | null>(null);
  const socialBase = useMemo(() => `${apiBase}/v1/auth`, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const ref = String(url.searchParams.get("ref") ?? "").trim().toLowerCase();
    if (ref) setReferralCode(ref);
    void (async () => {
      const response = await fetch(`${apiBase}/v1/vendor/me`, {
        headers: { ...clientPageHeader },
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && Boolean(payload?.isVendorMember)) {
        router.replace("/vendor");
        return;
      }
    })();
    void (async () => {
      const response = await fetch(`${apiBase}/v1/auth/me`, {
        headers: clientPageHeader,
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.user?.email) {
        setUser({ email: String(payload.user.email) });
      }
    })();
    void fetch(`${apiBase}/v1/vendor/current`, {
      headers: { ...clientPageHeader },
      credentials: "include",
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        setTheme(payload?.vendor?.vendorSettings ?? null);
        setBranding({
          logoImageUrl: normalizeVendorLogoUrl(payload?.vendor?.logoImageUrl) || null,
          faviconImageUrl: normalizeVendorFaviconUrl(payload?.vendor?.faviconImageUrl, payload?.vendor?.logoImageUrl) || null,
        });
      })
      .catch(() => null);
  }, []);

  async function logout() {
    await fetch(`${apiBase}/v1/auth/logout`, {
      method: "POST",
      headers: clientPageHeader,
      credentials: "include",
      cache: "no-store",
    }).catch(() => null);
    setUser(null);
    setMessage("You have been logged out.");
  }

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

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`${apiBase}/v1/auth/register`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...clientPageHeader,
        },
        credentials: "include",
        body: JSON.stringify({ email, password, referralCode: referralCode || undefined }),
      });

      const payload = await response.json();
      if (!response.ok) {
        if (payload?.vendorHost || String(payload?.error ?? "").toLowerCase().includes("vendor account")) {
          window.location.href = "/vendor/login?error=vendor_account";
          return;
        }
        throw new Error(payload.error ?? "Registration failed");
      }

      setMessage("Account created. Please verify OTP sent to your email.");
      setPassword("");
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  function startGoogleRegister(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const host = window.location.host.toLowerCase();
    const url = new URL(`${socialBase}/google/start`);
    url.searchParams.set("vendorHost", host);
    url.searchParams.set("intent", "customer_register");
    if (referralCode) url.searchParams.set("referralCode", referralCode);
    window.location.href = url.toString();
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
        <h1>Create Customer Account</h1>
        <p className="muted">Create a customer account first. After email verification, we will take you to the customer information page. Vendor applications use a separate approval flow.</p>

        <form className="auth-form" onSubmit={handleRegister}>
          <FormField label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
          </FormField>
          <FormField label="Password">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (8+ chars)" minLength={8} required />
          </FormField>
          <button type="submit" className="draw-button" disabled={loading}>{loading ? "Creating..." : "Create Customer Account"}</button>
        </form>

        <div className="auth-divider">Other login options</div>
        <div className="auth-social-row">
          <a className="auth-social-button google" href="#" onClick={startGoogleRegister}>
            <span className="google-g">G</span>
            <span>Continue with Google</span>
          </a>
        </div>

        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="badge">{message}</p> : null}

        <p className="muted" style={{ marginTop: 14 }}>
          Already have a customer account? <Link href="/login">Login</Link>
        </p>
      </section>
    </main>
  );
}




