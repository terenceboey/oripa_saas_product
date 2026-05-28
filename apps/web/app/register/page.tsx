"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const vendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const googleStart = `${apiBase}/v1/auth/google/start?vendorHost=${encodeURIComponent(vendorHost)}`;

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
          "x-vendor-host": vendorHost,
        },
        body: JSON.stringify({ displayName, email, password }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Registration failed");

      setMessage("Account created. Please verify OTP sent to your email.");
      setPassword("");
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
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
        <h1>Create Account</h1>
        <p className="muted">Register as a customer and start topping up points.</p>

        <form className="auth-form" onSubmit={handleRegister}>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" required />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (8+ chars)" minLength={8} required />
          <button type="submit" className="draw-button" disabled={loading}>{loading ? "Creating..." : "Register"}</button>
        </form>

        <div className="auth-divider">Other login options</div>
        <div className="auth-social-row">
          <a className="auth-social-button google" href={googleStart}>
            <span className="google-g">G</span>
            <span>Continue with Google</span>
          </a>
        </div>

        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="badge">{message}</p> : null}

        <p className="muted" style={{ marginTop: 14 }}>
          Already have an account? <Link href="/login">Login</Link>
        </p>
      </section>
    </main>
  );
}




