"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FormField } from "../../../components/form-field";
import { apiBaseUrl, apiFetch } from "../../../lib/api";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const response = await apiFetch(`${apiBaseUrl}/v1/super-admin/me`, {
          credentials: "include",
          cache: "no-store",
        });
        if (response.ok) {
          router.replace("/super-admin");
          return;
        }
      } finally {
        setChecking(false);
      }
    })();
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await apiFetch(`${apiBaseUrl}/v1/auth/super-admin/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Super admin login failed");

      setMessage("Super admin login successful.");
      window.setTimeout(() => {
        router.replace(String(payload.redirectTo ?? "/super-admin"));
      }, 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Super admin login failed");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="container">
        <section className="card auth-card">
          <h1>Super Admin Login</h1>
          <p className="muted">Checking session...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="container">
      <header className="auth-top-nav">
        <Link href="/" className="sort-pill">
          Back to Home
        </Link>
      </header>

      <section className="card auth-card">
        <h1>Super Admin Login</h1>
        <p className="muted">
          This area is restricted to the single platform super admin account.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <FormField label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Super admin email" required />
          </FormField>
          <FormField label="Password">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
          </FormField>
          <button type="submit" className="draw-button" disabled={loading}>
            {loading ? "Signing in..." : "Sign in as Super Admin"}
          </button>
        </form>

        {message ? <p className="badge">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>
    </main>
  );
}
