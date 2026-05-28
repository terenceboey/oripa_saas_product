"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const vendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";

type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  lastLoginAt?: string | null;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const socialBase = useMemo(() => `${apiBase}/v1/auth`, []);

  async function loadProfile(token: string) {
    const response = await fetch(`${apiBase}/v1/auth/me`, {
      headers: {
        authorization: `Bearer ${token}`,
        "x-vendor-host": vendorHost,
      },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? "Failed to load profile");
    setUser(payload.user ?? null);
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token");
    const oauthError = url.searchParams.get("error");

    if (token) {
      localStorage.setItem("oripa_access_token", token);
      setMessage("Logged in successfully. You can continue to the storefront.");
      void loadProfile(token);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.toString());
      window.setTimeout(() => {
        router.push("/");
      }, 500);
    }

    if (oauthError) {
      setError(`OAuth login failed: ${oauthError}`);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }

    const existingToken = localStorage.getItem("oripa_access_token");
    if (existingToken) {
      void loadProfile(existingToken).catch(() => {
        localStorage.removeItem("oripa_access_token");
      });
    }
  }, []);

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
          "x-vendor-host": vendorHost,
        },
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Login failed");

      localStorage.setItem("oripa_access_token", payload.token);
      setMessage("Logged in successfully.");
      await loadProfile(payload.token);
      window.setTimeout(() => {
        router.push("/");
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <header className="auth-top-nav">
        <Link href="/" className="sort-pill">Back to Home</Link>
      </header>

      <section className="card auth-card">
        <h1>Login</h1>
        <p className="muted">Sign in with email/password, Google, or Apple.</p>

        <form className="auth-form" onSubmit={handleLogin}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
          <button type="submit" className="draw-button" disabled={loading}>{loading ? "Signing in..." : "Login"}</button>
        </form>

        <div className="auth-divider">Other login options</div>
        <div className="auth-social-row">
          <a className="auth-social-button google" href={`${socialBase}/google/start?vendorHost=${encodeURIComponent(vendorHost)}`}>
            <span className="google-g">G</span>
            <span>Log in with Google</span>
          </a>
        </div>

        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="badge">{message}</p> : null}
        {user ? (
          <div className="auth-profile-card">
            <strong>Signed in as {user.displayName || "Customer"}</strong>
            <div className="muted tiny">{user.email}</div>
            <div className="muted tiny">Status: {user.status}</div>
          </div>
        ) : null}

        <p className="muted" style={{ marginTop: 14 }}>
          No account? <Link href="/register">Create one</Link>
        </p>
      </section>
    </main>
  );
}




