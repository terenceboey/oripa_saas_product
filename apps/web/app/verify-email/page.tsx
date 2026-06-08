"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FormField } from "../../components/form-field";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const clientPageHeader = { "x-client-page": "/verify-email" };

export default function VerifyEmailPage() {
  const router = useRouter();
  const runtimeVendorHost = useMemo(() => {
    const queryHost = typeof window !== "undefined" ? new URL(window.location.href).searchParams.get("vendorHost") : null;
    if (queryHost?.trim()) return queryHost.trim().toLowerCase();
    if (typeof window !== "undefined" && window.location?.host) return window.location.host.toLowerCase();
    return configuredVendorHost;
  }, []);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const returnTo = useMemo(() => {
    const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
    const raw = String(url?.searchParams.get("returnTo") ?? "").trim();
    if (raw.startsWith("/")) return raw;
    return `/profile?vendorHost=${encodeURIComponent(runtimeVendorHost)}`;
  }, [runtimeVendorHost]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const qEmail = String(url.searchParams.get("email") ?? "").trim();
    if (qEmail) setEmail(qEmail);
  }, []);

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${apiBase}/v1/auth/verify-email-otp`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...clientPageHeader,
        },
        credentials: "include",
        body: JSON.stringify({ email, otp }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "OTP verification failed");

      setMessage("Email verified and login successful.");
      setOtp("");
      window.setTimeout(() => {
        if (returnTo.startsWith("/vendor") && runtimeVendorHost && window.location.host.toLowerCase() !== runtimeVendorHost) {
          window.location.assign(`${window.location.protocol}//${runtimeVendorHost}${returnTo}`);
          return;
        }
        router.push(returnTo);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    setResending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${apiBase}/v1/auth/resend-email-otp`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...clientPageHeader,
        },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Failed to resend OTP");
      setMessage("OTP sent. Please check your email.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend OTP");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="container">
      <header className="auth-top-nav">
        <Link href="/" className="sort-pill">Back to Home</Link>
      </header>
      <section className="card auth-card">
        <h1>Verify Email</h1>
        <p className="muted">Enter the 6-digit OTP sent to your email to activate your account.</p>
        <form className="auth-form" onSubmit={handleVerify}>
          <FormField label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
          </FormField>
          <FormField label="6-digit OTP">
            <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit OTP" inputMode="numeric" pattern="\d{6}" required />
          </FormField>
          <button type="submit" className="draw-button" disabled={loading}>{loading ? "Verifying..." : "Verify OTP"}</button>
          <button type="button" className="sort-pill" disabled={resending} onClick={resendOtp}>{resending ? "Sending..." : "Resend OTP"}</button>
        </form>
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="badge">{message}</p> : null}
        <p className="muted" style={{ marginTop: 14 }}>
          Already verified? <Link href="/login">Login</Link>
        </p>
      </section>
    </main>
  );
}




