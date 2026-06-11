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
const clientPageHeader = { "x-client-page": "/login" };

function buildVendorLoginUrl(vendorHost: string, error?: string | null) {
  const host = String(vendorHost ?? "").trim().toLowerCase();
  const url = new URL("/vendor/login", window.location.origin);
  if (host && host !== window.location.host.toLowerCase()) {
    url.host = host;
  }
  if (error) url.searchParams.set("error", error);
  return url.toString();
}

type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  fullName?: string | null;
  dateOfBirth?: string | null;
  countryCode?: string | null;
  status: string;
  profileComplete?: boolean;
  lastLoginAt?: string | null;
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

export default function LoginPage() {
  const router = useRouter();
  const runtimeVendorHost = useMemo(() => {
    if (typeof window !== "undefined" && window.location?.host) return window.location.host.toLowerCase();
    return configuredVendorHost;
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [theme, setTheme] = useState<VendorTheme | null>(null);
  const [branding, setBranding] = useState<VendorBranding | null>(null);

  const socialBase = useMemo(() => `${apiBase}/v1/auth`, []);

  async function loadProfile() {
    const response = await fetch(`${apiBase}/v1/auth/me`, {
      headers: clientPageHeader,
      credentials: "include",
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? "Failed to load profile");
    const nextUser = (payload.user ?? null) as AuthUser | null;
    setUser(nextUser);
    return nextUser;
  }

  async function loadVendorMembership() {
    const response = await fetch(`${apiBase}/v1/vendor/me`, {
      headers: { ...clientPageHeader },
      credentials: "include",
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    return response.ok && Boolean(payload?.isVendorMember);
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token");
    const callbackVendorHost = String(url.searchParams.get("vendorHost") ?? "").trim().toLowerCase();
    const oauthError = url.searchParams.get("error");

    if (token || callbackVendorHost) {
      setMessage("Customer login successful. You can continue to the storefront.");
      void loadProfile();
      url.searchParams.delete("token");
      url.searchParams.delete("vendorHost");
      window.history.replaceState({}, "", url.toString());
      window.setTimeout(() => {
        void (async () => {
          const nextUser = await loadProfile().catch(() => null);
          if (!nextUser?.profileComplete) {
            router.push(`/profile?vendorHost=${encodeURIComponent(callbackVendorHost || runtimeVendorHost)}`);
            return;
          }
          router.push("/");
        })();
      }, 500);
    }

    if (oauthError) {
      setError(`OAuth login failed: ${oauthError}`);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }

    void (async () => {
      const isVendorMember = await loadVendorMembership().catch(() => false);
      if (isVendorMember) {
        router.replace("/vendor");
        return;
      }
      void loadProfile().catch(() => {});
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
  }, [runtimeVendorHost]);

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

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`${apiBase}/v1/auth/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...clientPageHeader,
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json();
      if (!response.ok) {
        if (payload?.vendorHost || String(payload?.error ?? "").toLowerCase().includes("vendor account")) {
          window.location.href = buildVendorLoginUrl(String(payload?.vendorHost ?? runtimeVendorHost), "vendor_account");
          return;
        }
        throw new Error(payload.error ?? "Login failed");
      }

      setMessage("Customer login successful.");
      const nextUser = (payload.user ?? (await loadProfile())) as AuthUser | null;
      setUser(nextUser);
      window.setTimeout(() => {
        void (async () => {
          if (!nextUser?.profileComplete) {
            router.push(`/profile?vendorHost=${encodeURIComponent(runtimeVendorHost)}`);
            return;
          }
          router.push("/");
        })();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  function startGoogleLogin(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const host = window.location.host.toLowerCase();
    const url = new URL(`${socialBase}/google/start`);
    url.searchParams.set("vendorHost", host);
    url.searchParams.set("intent", "customer_login");
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
        <h1>Customer Login</h1>
        <p className="muted">Sign in as a customer with email/password or Google. Vendor accounts use a separate login and approval flow.</p>

        <form className="auth-form" onSubmit={handleLogin}>
          <FormField label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
          </FormField>
          <FormField label="Password">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
          </FormField>
          <button type="submit" className="draw-button" disabled={loading}>{loading ? "Signing in..." : "Customer Login"}</button>
        </form>

        <div className="auth-divider">Other login options</div>
        <div className="auth-social-row">
          <a className="auth-social-button google" href="#" onClick={startGoogleLogin}>
            <span className="google-g">G</span>
            <span>Continue with Google</span>
          </a>
        </div>

        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="badge">{message}</p> : null}
        {user ? (
          <div className="auth-profile-card">
            <strong>Signed in as {user.displayName || user.fullName || "Customer"}</strong>
            <div className="muted tiny">{user.email}</div>
            <div className="muted tiny">Status: {user.status}</div>
            <div className="muted tiny">{user.profileComplete ? "Profile complete" : "Profile needs completion"}</div>
            <div className="muted tiny"><Link href="/profile">Edit customer profile</Link></div>
          </div>
        ) : null}

        <p className="muted" style={{ marginTop: 14 }}>
          No customer account? <Link href="/register">Create one</Link>
        </p>
      </section>
    </main>
  );
}




