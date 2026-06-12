"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiBaseUrl, apiFetch } from "../../../../lib/api";

type VendorMember = {
  id: string;
  userId: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    status: string;
    lastLoginAt: string | null;
  };
};

type VendorDetail = {
  id: string;
  name: string;
  slug: string;
  host: string;
  logoImageUrl?: string | null;
  faviconImageUrl?: string | null;
  referralCode?: string | null;
  businessLocation?: string | null;
  businessContact?: string | null;
  applicationStatus: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  entityName?: string | null;
  yearsOfOperations?: string | null;
  personInCharge?: string | null;
  personInChargeDateOfBirth?: string | null;
  personInChargeCountry?: string | null;
  identificationDocumentType?: string | null;
  identificationDocumentUrl?: string | null;
  businessRegistrationNumber?: string | null;
  registeredBusinessAddressLine1?: string | null;
  registeredBusinessAddressLine2?: string | null;
  registeredBusinessAddressCity?: string | null;
  registeredBusinessAddressStateProvince?: string | null;
  registeredBusinessAddressPostalCode?: string | null;
  registeredBusinessAddressCountry?: string | null;
  contactPhoneNumber?: string | null;
  businessEmail?: string | null;
  businessWebsiteUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  xUrl?: string | null;
  linkedinUrl?: string | null;
  youtubeUrl?: string | null;
  payoutBankAccountHolderName?: string | null;
  payoutBankName?: string | null;
  payoutBankCountry?: string | null;
  payoutBankAccountNumber?: string | null;
  payoutBankIban?: string | null;
  payoutBankSwiftBic?: string | null;
  payoutBankBranchCode?: string | null;
  applicationSubmittedAt?: string | null;
  applicationReviewedAt?: string | null;
  applicationReviewNotes?: string | null;
  isActive: boolean;
  riskLevel: number;
  complianceFlags?: unknown;
  createdAt?: string | null;
  updatedAt?: string | null;
  members: VendorMember[];
};

function formatAddress(vendor: VendorDetail) {
  const parts = [
    vendor.registeredBusinessAddressLine1,
    vendor.registeredBusinessAddressLine2,
    [vendor.registeredBusinessAddressCity, vendor.registeredBusinessAddressStateProvince].filter(Boolean).join(", ") || null,
    vendor.registeredBusinessAddressPostalCode,
    vendor.registeredBusinessAddressCountry,
  ].map((part) => String(part ?? "").trim()).filter(Boolean);
  return parts.length ? parts.join(" | ") : "-";
}

function formatBank(vendor: VendorDetail) {
  const parts = [
    vendor.payoutBankAccountHolderName && `Holder: ${vendor.payoutBankAccountHolderName}`,
    vendor.payoutBankName && `Bank: ${vendor.payoutBankName}`,
    vendor.payoutBankCountry && `Country: ${vendor.payoutBankCountry}`,
    vendor.payoutBankAccountNumber && `Account: ${vendor.payoutBankAccountNumber}`,
    vendor.payoutBankIban && `IBAN: ${vendor.payoutBankIban}`,
    vendor.payoutBankSwiftBic && `SWIFT/BIC: ${vendor.payoutBankSwiftBic}`,
    vendor.payoutBankBranchCode && `Branch: ${vendor.payoutBankBranchCode}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" | ") : "-";
}

function formatSocial(vendor: VendorDetail) {
  const parts = [
    vendor.businessWebsiteUrl && `Website: ${vendor.businessWebsiteUrl}`,
    vendor.facebookUrl && `Facebook: ${vendor.facebookUrl}`,
    vendor.instagramUrl && `Instagram: ${vendor.instagramUrl}`,
    vendor.tiktokUrl && `TikTok: ${vendor.tiktokUrl}`,
    vendor.xUrl && `X: ${vendor.xUrl}`,
    vendor.linkedinUrl && `LinkedIn: ${vendor.linkedinUrl}`,
    vendor.youtubeUrl && `YouTube: ${vendor.youtubeUrl}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" | ") : "-";
}

export default function SuperAdminVendorDetailPage() {
  const router = useRouter();
  const params = useParams<{ vendorId: string }>();
  const vendorId = useMemo(() => String(params?.vendorId ?? "").trim(), [params]);
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadVendor() {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`${apiBaseUrl}/v1/super-admin/vendors/${vendorId}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (response.status === 401 || response.status === 403) {
        router.replace("/super-admin/login");
        return;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Failed to load vendor");
      setVendor(payload.vendor as VendorDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vendor");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!vendorId) return;
    void loadVendor();
  }, [vendorId]);

  async function reviewVendor(nextAction: "approve" | "reject") {
    setActionLoading(nextAction);
    try {
      const notes = nextAction === "reject" ? window.prompt("Optional rejection notes") ?? "" : "";
      const response = await apiFetch(`${apiBaseUrl}/v1/super-admin/vendors/${vendorId}/${nextAction}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notes }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Action failed");
      await loadVendor();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <main className="container">
      <header className="auth-top-nav profile-top-nav">
        <Link href="/super-admin" className="sort-pill">
          Back to Dashboard
        </Link>
        <Link href="/" className="sort-pill">
          Home
        </Link>
      </header>

      <section className="card auth-card">
        <h1>Vendor Review</h1>
        <p className="muted">Inspect and update vendor application state.</p>
        {loading ? <p className="muted">Loading vendor...</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      {vendor ? (
        <>
          <section className="card auth-card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h2>{vendor.name}</h2>
                <p className="muted" style={{ margin: 0 }}>
                  {vendor.host} | {vendor.applicationStatus} | {vendor.isActive ? "active" : "inactive"}
                </p>
              </div>
              <span className="badge">Risk {vendor.riskLevel}</span>
            </div>

            <div className="badge-grid" style={{ marginTop: 16 }}>
              <div className="badge">Entity: {vendor.entityName ?? "-"}</div>
              <div className="badge">PIC: {vendor.personInCharge ?? "-"}</div>
              <div className="badge">Years: {vendor.yearsOfOperations ?? "-"}</div>
              <div className="badge">Country: {vendor.personInChargeCountry ?? "-"}</div>
              <div className="badge">Business Reg: {vendor.businessRegistrationNumber ?? "-"}</div>
              <div className="badge">Phone: {vendor.contactPhoneNumber ?? "-"}</div>
            </div>

            <div style={{ display: "grid", gap: 8, marginTop: 16 }}>              <div><strong>Business email:</strong> {vendor.businessEmail ?? "-"}</div>
              <div><strong>Website/social:</strong> {formatSocial(vendor)}</div>
              <div><strong>Registered address:</strong> {formatAddress(vendor)}</div>
              <div><strong>Payout details:</strong> {formatBank(vendor)}</div>
              <div><strong>Document:</strong> {vendor.identificationDocumentType ?? "-"}{vendor.identificationDocumentUrl ? ` | ${vendor.identificationDocumentUrl}` : ""}</div>
              <div><strong>Submitted:</strong> {vendor.applicationSubmittedAt ?? "-"}</div>
              <div><strong>Reviewed:</strong> {vendor.applicationReviewedAt ?? "-"}</div>
              <div><strong>Notes:</strong> {vendor.applicationReviewNotes ?? "-"}</div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              <button type="button" className="draw-button" disabled={actionLoading !== null} onClick={() => void reviewVendor("approve")}>
                Approve
              </button>
              <button type="button" className="sort-pill" disabled={actionLoading !== null} onClick={() => void reviewVendor("reject")}>
                Reject
              </button>
            </div>
          </section>

          <section className="card auth-card">
            <h2>Members</h2>
            {vendor.members.length ? (
              <div style={{ display: "grid", gap: 12 }}>
                {vendor.members.map((member) => (
                  <article key={member.id} className="card" style={{ background: "var(--card)" }}>
                    <strong>{member.user.email}</strong>
                    <div className="muted" style={{ marginTop: 4 }}>
                      Role: {member.role} | {member.isActive ? "active" : "inactive"}
                    </div>
                    <div className="muted">Display name: {member.user.displayName ?? "-"}</div>
                    <div className="muted">Status: {member.user.status}</div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">No members found.</p>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
