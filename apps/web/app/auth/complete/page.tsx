"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const clientPageHeader = { "x-client-page": "/auth/complete" };

type AuthUser = {
  id: string;
  email: string;
  profileComplete?: boolean;
};

function isLocalhostLike(host: string) {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "demo.localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.startsWith("127.0.0.1") ||
    normalized.startsWith("0.0.0.0")
  );
}

export default function AuthCompletePage() {
  return (
    <Suspense fallback={<AuthCompleteShell message="Finishing sign-in..." />}>
      <AuthCompleteContent />
    </Suspense>
  );
}

function AuthCompleteShell({ message }: { message: string }) {
  return (
    <main className="container">
      <section className="card auth-card">
        <h1>Finishing Sign-In</h1>
        <p className="muted">{message}</p>
      </section>
    </main>
  );
}

function AuthCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("Checking your account...");

  const runtimeVendorHost = useMemo(() => {
    const queryHost = String(searchParams.get("vendorHost") ?? "").trim().toLowerCase();
    if (queryHost) return queryHost;
    if (typeof window !== "undefined" && window.location?.host) return window.location.host.toLowerCase();
    return configuredVendorHost;
  }, [searchParams]);

  async function loadProfileWithRetry() {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await fetch(`${apiBase}/v1/auth/me`, {
        headers: clientPageHeader,
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) return (payload.user ?? null) as AuthUser | null;
      lastError = new Error(payload.error ?? "Unable to confirm your login session.");
      await new Promise((resolve) => window.setTimeout(resolve, 250 + attempt * 200));
    }
    throw lastError ?? new Error("Unable to confirm your login session.");
  }

  async function resolveVendorHomeHost(): Promise<string | null> {
    try {
      const response = await fetch(`${apiBase}/v1/auth/vendor-home`, {
        headers: clientPageHeader,
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return null;
      const host = String(payload.vendorHost ?? "").trim().toLowerCase();
      return host || null;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const nextUser = await loadProfileWithRetry();
        if (!active) return;
        if (!nextUser?.profileComplete) {
          setMessage("Taking you to the customer information page...");
          router.replace(`/profile?vendorHost=${encodeURIComponent(runtimeVendorHost)}`);
          return;
        }

        const membershipHost = await resolveVendorHomeHost();
        if (!active) return;
        const currentHost = window.location.host.toLowerCase();
        if (membershipHost && !isLocalhostLike(membershipHost) && membershipHost !== currentHost) {
          window.location.href = `${window.location.protocol}//${membershipHost}/vendor`;
          return;
        }
        router.replace(membershipHost ? "/vendor" : "/");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to finish sign-in.");
        setMessage("We could not confirm your login session.");
      }
    })();

    return () => {
      active = false;
    };
  }, [router, runtimeVendorHost]);

  return (
    <main className="container">
      <section className="card auth-card">
        <h1>Finishing Sign-In</h1>
        <p className="muted">{message}</p>
        {error ? (
          <p className="error">
            {error} <Link href="/login">Return to login</Link>
          </p>
        ) : null}
      </section>
    </main>
  );
}
