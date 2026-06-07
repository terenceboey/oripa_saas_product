"use client";

import { Suspense } from "react";
import { VendorApplicationForm } from "../../../components/vendor-application-form";

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
  return (
    <main className="container">
      <VendorApplicationForm
        title="Vendor Profile"
        description="Complete your vendor application after email verification and keep your business details updated. This information is used for approval review."
        primaryActionLabel="Save Vendor Profile"
        note="Please upload your identifying document before submitting the final application."
      />
    </main>
  );
}
