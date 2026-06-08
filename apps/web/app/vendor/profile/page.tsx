"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { VendorApplicationForm } from "../../../components/vendor-application-form";
const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const clientPageHeader = { "x-client-page": "/vendor/profile" };

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

export default function VendorProfilePage() {
  return (
    <Suspense fallback={<VendorProfileFallback />}>
      <VendorProfileContent />
    </Suspense>
  );
}

function VendorProfileFallback() {
  return (
    <main className="container">
      <section className="card auth-card">
        <h1>Vendor Profile</h1>
        <p className="muted">Loading vendor profile...</p>
      </section>
    </main>
  );
}

function VendorProfileContent() {
  const router = useRouter();
  const runtimeVendorHost =
    typeof window !== "undefined" && window.location?.host
      ? (isLocalhostLike(window.location.host.toLowerCase()) ? configuredVendorHost : window.location.host.toLowerCase())
      : configuredVendorHost;

  async function logout() {
    await fetch(`${apiBase}/v1/auth/logout`, {
      method: "POST",
      headers: { ...clientPageHeader },
      credentials: "include",
    }).catch(() => null);
    router.replace("/vendor/login");
  }

  return (
    <main className="container">
      <header className="auth-top-nav profile-top-nav">
        <Link href="/vendor" className="sort-pill">
          Back to Dashboard
        </Link>
        <button type="button" className="sort-pill" onClick={() => void logout()}>
          Logout
        </button>
      </header>
      <VendorApplicationForm
        title="Vendor Profile"
        description="Complete your vendor application after email verification and keep your business details updated. This information is used for approval review."
        primaryActionLabel="Save Vendor Profile"
        note="Please upload your identifying document before submitting the final application."
      />
    </main>
  );
}
