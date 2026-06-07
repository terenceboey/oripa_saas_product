"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormField } from "../../../components/form-field";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const clientPageHeader = { "x-client-page": "/vendor/login" };

function isLocalhostLike(host: string) {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.startsWith("localhost:") ||
    normalized === "demo.localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.startsWith("127.0.0.1") ||
    normalized.startsWith("0.0.0.0")
  );
}

export default function VendorLoginPage() {
  return (
    <Suspense fallback={<VendorLoginShell />}>
      <VendorLoginContent />
    </Suspense>
  );
}

function VendorLoginShell() {
  return (
    <main className="container">
      <section className="card auth-card">
        <h1>Vendor Login</h1>
        <p className="muted">Loading vendor access...</p>
      </section>
    </main>
  );
}

function VendorLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runtimeVendorHost = useMemo(() => {
    if (typeof window !== "undefined" && window.location?.host) {
      const host = window.location.host.toLowerCase();
      return isLocalhostLike(host) ? configuredVendorHost : host;
    }
    return configuredVendorHost;
  }, []);
  const returnTo = useMemo(() => {
    const raw = String(searchParams.get("returnTo") ?? "/vendor");
    return raw.startsWith("/vendor") && !raw.startsWith("//") ? raw : "/vendor";
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleVendorLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`${apiBase}/v1/auth/vendor/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-vendor-host": runtimeVendorHost,
          ...clientPageHeader,
        },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Vendor login failed");

      setMessage("Vendor login successful.");
      window.setTimeout(() => {
        router.replace(returnTo);
      }, 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vendor login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <section className="card auth-card">
        <h1>Vendor Login</h1>
        <p className="muted">
          Sign in with an approved vendor account. Vendor access is granted only after super admin approval.
        </p>

        <form className="auth-form" onSubmit={handleVendorLogin}>
          <FormField label="Vendor email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Vendor email" required />
          </FormField>
          <FormField label="Password">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
          </FormField>
          <button type="submit" className="draw-button" disabled={loading}>
            {loading ? "Signing in..." : "Vendor Login"}
          </button>
        </form>

        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="badge">{message}</p> : null}
      </section>
    </main>
  );
}
