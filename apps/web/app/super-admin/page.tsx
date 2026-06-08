"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiBaseUrl, apiFetch } from "../../lib/api";

type SuperAdminVendor = {
  id: string;
  name: string;
  slug: string;
  host: string;
  isActive: boolean;
  riskLevel: number;
  applicationStatus: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  entityName?: string | null;
  yearsOfOperations?: string | null;
  personInCharge?: string | null;
  personInChargeCountry?: string | null;
  businessRegistrationNumber?: string | null;
  registeredBusinessAddress?: string | null;
  contactPhoneNumber?: string | null;
  businessEmail?: string | null;
  websiteOrSocialLinks?: string | null;
  identificationDocumentType?: string | null;
  identificationDocumentUrl?: string | null;
  applicationSubmittedAt?: string | null;
  applicationReviewedAt?: string | null;
  applicationReviewNotes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type DashboardResponse = {
  summary: {
    totalPending: number;
    draft: number;
    submitted: number;
    underReview: number;
    approved: number;
    rejected: number;
  };
  pendingVendors: SuperAdminVendor[];
};

export default function SuperAdminDashboardPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const summaryCards = useMemo(() => {
    const summary = dashboard?.summary;
    return [
      { label: "Pending", value: summary?.totalPending ?? 0 },
      { label: "Draft", value: summary?.draft ?? 0 },
      { label: "Submitted", value: summary?.submitted ?? 0 },
      { label: "Under Review", value: summary?.underReview ?? 0 },
      { label: "Approved", value: summary?.approved ?? 0 },
      { label: "Rejected", value: summary?.rejected ?? 0 },
    ];
  }, [dashboard]);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`${apiBaseUrl}/v1/super-admin/dashboard`, {
        credentials: "include",
        cache: "no-store",
      });
      if (response.status === 401 || response.status === 403) {
        router.replace("/super-admin/login");
        return;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Failed to load dashboard");
      setDashboard(payload as DashboardResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function logout() {
    await apiFetch(`${apiBaseUrl}/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    }).catch(() => null);
    router.replace("/super-admin/login");
  }

  async function reviewVendor(vendorId: string, nextAction: "approve" | "reject") {
    setActionLoading(vendorId);
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
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <main className="container">
      <header className="auth-top-nav profile-top-nav">
        <Link href="/" className="sort-pill">
          Back to Home
        </Link>
        <button type="button" className="sort-pill" onClick={() => void logout()}>
          Logout
        </button>
      </header>

      <section className="card auth-card">
        <h1>Super Admin</h1>
        <p className="muted">
          Review vendor approvals, inspect sensitive vendor details, and manage the platform.
        </p>

        <div className="badge-grid">
          {summaryCards.map((card) => (
            <div className="badge" key={card.label}>
              <strong style={{ display: "block", fontSize: 18 }}>{card.value}</strong>
              <span>{card.label}</span>
            </div>
          ))}
        </div>

        {loading ? <p className="muted">Loading dashboard...</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="card auth-card">
        <h2>Pending Vendor Applications</h2>
        {dashboard?.pendingVendors.length ? (
          <div style={{ display: "grid", gap: 16 }}>
            {dashboard.pendingVendors.map((vendor) => (
              <article key={vendor.id} className="card" style={{ background: "var(--card)", borderRadius: 18 }}>
                <div className="vendor-card-header" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                  <div>
                    <h3 style={{ marginBottom: 4 }}>{vendor.name}</h3>
                    <p className="muted" style={{ margin: 0 }}>
                      {vendor.host} · {vendor.applicationStatus}
                    </p>
                  </div>
                  <span className="badge">{vendor.isActive ? "Active" : "Inactive"}</span>
                </div>

                <div className="badge-grid" style={{ marginTop: 12 }}>
                  <div className="badge">Entity: {vendor.entityName ?? "-"}</div>
                  <div className="badge">PIC: {vendor.personInCharge ?? "-"}</div>
                  <div className="badge">Country: {vendor.personInChargeCountry ?? "-"}</div>
                  <div className="badge">Business Reg: {vendor.businessRegistrationNumber ?? "-"}</div>
                </div>

                <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                  <div><strong>Business email:</strong> {vendor.businessEmail ?? "-"}</div>
                  <div><strong>Contact phone:</strong> {vendor.contactPhoneNumber ?? "-"}</div>
                  <div><strong>Website/social:</strong> {vendor.websiteOrSocialLinks ?? "-"}</div>
                  <div><strong>Document:</strong> {vendor.identificationDocumentType ?? "-"}{vendor.identificationDocumentUrl ? ` · ${vendor.identificationDocumentUrl}` : ""}</div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                  <button
                    type="button"
                    className="draw-button"
                    style={{ minWidth: 140 }}
                    disabled={actionLoading === vendor.id}
                    onClick={() => void reviewVendor(vendor.id, "approve")}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="sort-pill"
                    disabled={actionLoading === vendor.id}
                    onClick={() => void reviewVendor(vendor.id, "reject")}
                  >
                    Reject
                  </button>
                  <Link href={`/super-admin/vendors/${vendor.id}`} className="sort-pill">
                    Open
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No pending vendor applications right now.</p>
        )}
      </section>
    </main>
  );
}
