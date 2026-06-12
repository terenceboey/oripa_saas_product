"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "./form-field";
import { COUNTRY_OPTIONS } from "../lib/countries";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const clientPageHeader = { "x-client-page": "/vendor/application" };
const draftStorageKey = "vendor-application-draft-v1";

type VendorApplication = {
  applicationStatus?: string | null;
  entityName?: string | null;
  yearsOfOperations?: "LT_1" | "ONE_TO_THREE" | "THREE_TO_FIVE" | "FIVE_PLUS" | null;
  personInCharge?: string | null;
  personInChargeDateOfBirth?: string | null;
  personInChargeCountry?: string | null;
  identificationDocumentType?: "PASSPORT" | "DRIVING_LICENCE" | null;
  identificationDocumentUrl?: string | null;
  businessRegistrationNumber?: string | null;
  contactPhoneNumber?: string | null;
  businessEmail?: string | null;
  applicationSubmittedAt?: string | null;
  applicationReviewedAt?: string | null;
  applicationReviewNotes?: string | null;
  updatedAt?: string | null;
};

type VendorApplicationFormProps = {
  title: string;
  description: string;
  primaryActionLabel: string;
  note?: string;
};

type StructuredAddressFields = {
  registeredBusinessAddressLine1: string;
  registeredBusinessAddressLine2: string;
  registeredBusinessAddressCity: string;
  registeredBusinessAddressStateProvince: string;
  registeredBusinessAddressPostalCode: string;
  registeredBusinessAddressCountry: string;
};

type StructuredBankFields = {
  payoutBankAccountHolderName: string;
  payoutBankName: string;
  payoutBankCountry: string;
  payoutBankAccountNumber: string;
  payoutBankIban: string;
  payoutBankSwiftBic: string;
  payoutBankBranchCode: string;
};

type StructuredSocialFields = {
  businessWebsiteUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  xUrl: string;
  linkedinUrl: string;
  youtubeUrl: string;
};

type FormState = {
  entityName: string;
  yearsOfOperations: "LT_1" | "ONE_TO_THREE" | "THREE_TO_FIVE" | "FIVE_PLUS" | "";
  personInCharge: string;
  personInChargeDateOfBirth: string;
  personInChargeCountry: string;
  identificationDocumentType: "PASSPORT" | "DRIVING_LICENCE" | "";
  identificationDocumentUrl: string;
  businessRegistrationNumber: string;
  contactPhoneNumber: string;
  businessEmail: string;
} & StructuredAddressFields & StructuredBankFields & StructuredSocialFields;

const DEFAULT_STATE: FormState = {
  entityName: "",
  yearsOfOperations: "",
  personInCharge: "",
  personInChargeDateOfBirth: "",
  personInChargeCountry: "",
  identificationDocumentType: "",
  identificationDocumentUrl: "",
  businessRegistrationNumber: "",
  contactPhoneNumber: "",
  businessEmail: "",
  registeredBusinessAddressLine1: "",
  registeredBusinessAddressLine2: "",
  registeredBusinessAddressCity: "",
  registeredBusinessAddressStateProvince: "",
  registeredBusinessAddressPostalCode: "",
  registeredBusinessAddressCountry: "",
  payoutBankAccountHolderName: "",
  payoutBankName: "",
  payoutBankCountry: "",
  payoutBankAccountNumber: "",
  payoutBankIban: "",
  payoutBankSwiftBic: "",
  payoutBankBranchCode: "",
  businessWebsiteUrl: "",
  facebookUrl: "",
  instagramUrl: "",
  tiktokUrl: "",
  xUrl: "",
  linkedinUrl: "",
  youtubeUrl: "",
};

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

function getRuntimeVendorHost() {
  if (typeof window !== "undefined" && window.location?.host) {
    const host = window.location.host.toLowerCase();
    return isLocalhostLike(host) ? configuredVendorHost : host;
  }
  return configuredVendorHost;
}

function toStringValue(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeDraft(input: Record<string, unknown> | null | undefined): FormState {
  return {
    entityName: String(input?.entityName ?? ""),
    yearsOfOperations: (String(input?.yearsOfOperations ?? "") as FormState["yearsOfOperations"]) || "",
    personInCharge: String(input?.personInCharge ?? ""),
    personInChargeDateOfBirth: String(input?.personInChargeDateOfBirth ?? ""),
    personInChargeCountry: String(input?.personInChargeCountry ?? ""),
    identificationDocumentType: (String(input?.identificationDocumentType ?? "") as FormState["identificationDocumentType"]) || "",
    identificationDocumentUrl: String(input?.identificationDocumentUrl ?? ""),
    businessRegistrationNumber: String(input?.businessRegistrationNumber ?? ""),
    contactPhoneNumber: String(input?.contactPhoneNumber ?? ""),
    businessEmail: String(input?.businessEmail ?? ""),
    registeredBusinessAddressLine1: String(input?.registeredBusinessAddressLine1 ?? ""),
    registeredBusinessAddressLine2: String(input?.registeredBusinessAddressLine2 ?? ""),
    registeredBusinessAddressCity: String(input?.registeredBusinessAddressCity ?? ""),
    registeredBusinessAddressStateProvince: String(input?.registeredBusinessAddressStateProvince ?? ""),
    registeredBusinessAddressPostalCode: String(input?.registeredBusinessAddressPostalCode ?? ""),
    registeredBusinessAddressCountry: String(input?.registeredBusinessAddressCountry ?? ""),
    payoutBankAccountHolderName: String(input?.payoutBankAccountHolderName ?? ""),
    payoutBankName: String(input?.payoutBankName ?? ""),
    payoutBankCountry: String(input?.payoutBankCountry ?? ""),
    payoutBankAccountNumber: String(input?.payoutBankAccountNumber ?? ""),
    payoutBankIban: String(input?.payoutBankIban ?? ""),
    payoutBankSwiftBic: String(input?.payoutBankSwiftBic ?? ""),
    payoutBankBranchCode: String(input?.payoutBankBranchCode ?? ""),
    businessWebsiteUrl: String(input?.businessWebsiteUrl ?? ""),
    facebookUrl: String(input?.facebookUrl ?? ""),
    instagramUrl: String(input?.instagramUrl ?? ""),
    tiktokUrl: String(input?.tiktokUrl ?? ""),
    xUrl: String(input?.xUrl ?? ""),
    linkedinUrl: String(input?.linkedinUrl ?? ""),
    youtubeUrl: String(input?.youtubeUrl ?? ""),
  };
}

function toDateInputValue(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

export function VendorApplicationForm({
  title,
  description,
  primaryActionLabel,
  note,
}: VendorApplicationFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);

  const runtimeVendorHost = useMemo(() => getRuntimeVendorHost(), []);

  useEffect(() => {
    let active = true;

    void (async () => {
      const draftRaw = typeof window !== "undefined" ? window.localStorage.getItem(draftStorageKey) : null;
      if (draftRaw) {
        try {
          const draft = JSON.parse(draftRaw) as Partial<FormState>;
          if (active) setForm((current) => ({ ...current, ...normalizeDraft(draft) }));
        } catch {
          if (typeof window !== "undefined") window.localStorage.removeItem(draftStorageKey);
        }
      }

      try {
        const membershipResponse = await fetch(`${apiBase}/v1/vendor/me`, {
          headers: { ...clientPageHeader },
          credentials: "include",
          cache: "no-store",
        });
        const membershipPayload = await membershipResponse.json().catch(() => ({}));
        if (!membershipResponse.ok || !membershipPayload?.isVendorMember) {
          if (active) {
            setError(membershipPayload?.error ?? "Vendor access required.");
            setHasAccess(false);
          }
          return;
        }

        if (active) setHasAccess(true);

        const response = await fetch(`${apiBase}/v1/vendor/application`, {
          headers: { ...clientPageHeader },
          credentials: "include",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        if (!active || !response.ok) return;
        const application = (payload.application ?? null) as VendorApplication | null;
        if (!application) return;
        setApplicationStatus(application.applicationStatus ?? null);
        setForm((current) => ({
          ...current,
          ...normalizeDraft(application as Record<string, unknown>),
          entityName: application.entityName ?? current.entityName,
          yearsOfOperations: (application.yearsOfOperations ?? current.yearsOfOperations) as FormState["yearsOfOperations"],
          personInCharge: application.personInCharge ?? current.personInCharge,
          personInChargeDateOfBirth: toDateInputValue(application.personInChargeDateOfBirth) || current.personInChargeDateOfBirth,
          personInChargeCountry: application.personInChargeCountry ?? current.personInChargeCountry,
          identificationDocumentType: (application.identificationDocumentType ?? current.identificationDocumentType) as FormState["identificationDocumentType"],
          identificationDocumentUrl: application.identificationDocumentUrl ?? current.identificationDocumentUrl,
          businessRegistrationNumber: application.businessRegistrationNumber ?? current.businessRegistrationNumber,
          contactPhoneNumber: application.contactPhoneNumber ?? current.contactPhoneNumber,
          businessEmail: application.businessEmail ?? current.businessEmail,
        }));
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load vendor application");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [runtimeVendorHost]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function uploadDocument(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${apiBase}/v1/vendor/media/documents`, {
        method: "POST",
        headers: {
          ...clientPageHeader,
        },
        credentials: "include",
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Document upload failed");
      updateField("identificationDocumentUrl", String(payload.documentUrl ?? ""));
      setMessage("Document uploaded.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Document upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function saveApplication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    if (!form.identificationDocumentUrl.trim()) {
      setSaving(false);
      setError("Please upload your identifying document before saving.");
      return;
    }

    try {
      const response = await fetch(`${apiBase}/v1/vendor/application`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...clientPageHeader,
        },
        credentials: "include",
        body: JSON.stringify({
          ...form,
          identificationDocumentUrl: form.identificationDocumentUrl.trim() ? form.identificationDocumentUrl.trim() : undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Failed to save vendor application");
      setApplicationStatus(payload.application?.applicationStatus ?? "SUBMITTED");
      setMessage("Vendor application saved.");
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(draftStorageKey);
      }
      window.setTimeout(() => {
        router.replace("/vendor");
      }, 300);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save vendor application");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card auth-card" style={{ width: "100%", maxWidth: 960 }}>
      { !loading && !hasAccess ? (
        <>
          <h1>Vendor Access Required</h1>
          <p className="error">{error ?? "You do not have access to this vendor page."}</p>
        </>
      ) : (
        <>
      <h1>{title}</h1>
      <p className="muted">{description}</p>
      {note ? <p className="badge">{note}</p> : null}
      {applicationStatus ? <p className="muted tiny">Application status: <strong>{applicationStatus}</strong></p> : null}
      {loading ? <p className="muted">Loading vendor details...</p> : null}

      {hasAccess ? (
        <form className="auth-form" onSubmit={saveApplication}>
          <section className="vendor-form-section">
            <h2>Business information</h2>
            <div className="vendor-form-grid">
              <FormField label="Entity name">
                <input value={form.entityName} onChange={(event) => updateField("entityName", event.target.value)} placeholder="Entity name" required />
              </FormField>

              <FormField label="Years of operations">
                <select value={form.yearsOfOperations} onChange={(event) => updateField("yearsOfOperations", event.target.value as FormState["yearsOfOperations"])} required>
                  <option value="">Select range</option>
                  <option value="LT_1">0-1 years</option>
                  <option value="ONE_TO_THREE">1-3 years</option>
                  <option value="THREE_TO_FIVE">3-5 years</option>
                  <option value="FIVE_PLUS">5+ years</option>
                </select>
              </FormField>

              <FormField label="Business registration number / tax ID (optional)">
                <input value={form.businessRegistrationNumber} onChange={(event) => updateField("businessRegistrationNumber", event.target.value)} placeholder="Business registration number / tax ID" />
              </FormField>

              <FormField label="Business email (optional)">
                <input type="email" value={form.businessEmail} onChange={(event) => updateField("businessEmail", event.target.value)} placeholder="Business email" />
              </FormField>

              <FormField label="Contact phone number (optional)">
                <input value={form.contactPhoneNumber} onChange={(event) => updateField("contactPhoneNumber", event.target.value)} placeholder="Contact phone number" />
              </FormField>
            </div>
          </section>

          <section className="vendor-form-section">
            <h2>Business address</h2>
            <div className="vendor-form-grid">
              <FormField label="Address line 1">
                <input value={form.registeredBusinessAddressLine1} onChange={(event) => updateField("registeredBusinessAddressLine1", event.target.value)} placeholder="Street address, building, or unit" required />
              </FormField>

              <FormField label="Address line 2 (optional)">
                <input value={form.registeredBusinessAddressLine2} onChange={(event) => updateField("registeredBusinessAddressLine2", event.target.value)} placeholder="Suite, floor, or apartment" />
              </FormField>

              <FormField label="City">
                <input value={form.registeredBusinessAddressCity} onChange={(event) => updateField("registeredBusinessAddressCity", event.target.value)} placeholder="City" required />
              </FormField>

              <FormField label="State / Province">
                <input value={form.registeredBusinessAddressStateProvince} onChange={(event) => updateField("registeredBusinessAddressStateProvince", event.target.value)} placeholder="State or province" required />
              </FormField>

              <FormField label="Postal code">
                <input value={form.registeredBusinessAddressPostalCode} onChange={(event) => updateField("registeredBusinessAddressPostalCode", event.target.value)} placeholder="Postal code" required />
              </FormField>

              <FormField label="Country">
                <select value={form.registeredBusinessAddressCountry} onChange={(event) => updateField("registeredBusinessAddressCountry", event.target.value)} required>
                  <option value="">Select country</option>
                  {COUNTRY_OPTIONS.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </section>

          <section className="vendor-form-section">
            <h2>Primary contact and identity</h2>
            <div className="vendor-form-grid">
              <FormField label="Person in charge">
                <input value={form.personInCharge} onChange={(event) => updateField("personInCharge", event.target.value)} placeholder="Person in charge" required />
              </FormField>

              <FormField label="Person in charge date of birth">
                <input type="date" value={form.personInChargeDateOfBirth} onChange={(event) => updateField("personInChargeDateOfBirth", event.target.value)} required />
              </FormField>

              <FormField label="Person in charge country">
                <select value={form.personInChargeCountry} onChange={(event) => updateField("personInChargeCountry", event.target.value)} required>
                  <option value="">Select country</option>
                  {COUNTRY_OPTIONS.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Identifying document type">
                <select value={form.identificationDocumentType} onChange={(event) => updateField("identificationDocumentType", event.target.value as FormState["identificationDocumentType"])} required>
                  <option value="">Select document</option>
                  <option value="PASSPORT">Passport</option>
                  <option value="DRIVING_LICENCE">Driving licence</option>
                </select>
              </FormField>
            </div>
          </section>

          <section className="vendor-form-section">
            <h2>Online presence</h2>
            <div className="vendor-form-grid">
              <FormField label="Business website URL">
                <input
                  type="url"
                  value={form.businessWebsiteUrl}
                  onChange={(event) => updateField("businessWebsiteUrl", event.target.value)}
                  placeholder="https://example.com"
                />
              </FormField>

              <FormField label="Facebook URL">
                <input
                  type="url"
                  value={form.facebookUrl}
                  onChange={(event) => updateField("facebookUrl", event.target.value)}
                  placeholder="https://facebook.com/..."
                />
              </FormField>

              <FormField label="Instagram URL">
                <input
                  type="url"
                  value={form.instagramUrl}
                  onChange={(event) => updateField("instagramUrl", event.target.value)}
                  placeholder="https://instagram.com/..."
                />
              </FormField>

              <FormField label="TikTok URL">
                <input
                  type="url"
                  value={form.tiktokUrl}
                  onChange={(event) => updateField("tiktokUrl", event.target.value)}
                  placeholder="https://www.tiktok.com/..."
                />
              </FormField>

              <FormField label="X URL">
                <input
                  type="url"
                  value={form.xUrl}
                  onChange={(event) => updateField("xUrl", event.target.value)}
                  placeholder="https://x.com/..."
                />
              </FormField>

              <FormField label="LinkedIn URL">
                <input
                  type="url"
                  value={form.linkedinUrl}
                  onChange={(event) => updateField("linkedinUrl", event.target.value)}
                  placeholder="https://linkedin.com/..."
                />
              </FormField>

              <FormField label="YouTube URL">
                <input
                  type="url"
                  value={form.youtubeUrl}
                  onChange={(event) => updateField("youtubeUrl", event.target.value)}
                  placeholder="https://youtube.com/..."
                />
              </FormField>
            </div>
          </section>

          <section className="vendor-form-section">
            <h2>Payout details</h2>
            <div className="vendor-form-grid">
              <FormField label="Account holder name">
                <input value={form.payoutBankAccountHolderName} onChange={(event) => updateField("payoutBankAccountHolderName", event.target.value)} placeholder="Account holder name" required />
              </FormField>

              <FormField label="Bank name">
                <input value={form.payoutBankName} onChange={(event) => updateField("payoutBankName", event.target.value)} placeholder="Bank name" required />
              </FormField>

              <FormField label="Bank country">
                <select value={form.payoutBankCountry} onChange={(event) => updateField("payoutBankCountry", event.target.value)} required>
                  <option value="">Select country</option>
                  {COUNTRY_OPTIONS.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Account number">
                <input value={form.payoutBankAccountNumber} onChange={(event) => updateField("payoutBankAccountNumber", event.target.value)} placeholder="Account number" />
              </FormField>

              <FormField label="IBAN (optional)">
                <input value={form.payoutBankIban} onChange={(event) => updateField("payoutBankIban", event.target.value)} placeholder="IBAN" />
              </FormField>

              <FormField label="SWIFT / BIC (optional)">
                <input value={form.payoutBankSwiftBic} onChange={(event) => updateField("payoutBankSwiftBic", event.target.value)} placeholder="SWIFT / BIC" />
              </FormField>

              <FormField label="Branch code (optional)">
                <input value={form.payoutBankBranchCode} onChange={(event) => updateField("payoutBankBranchCode", event.target.value)} placeholder="Branch code" />
              </FormField>
            </div>
          </section>

          <section className="vendor-form-section">
            <h2>Supporting document</h2>
            <FormField label="Upload identifying document">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={(event) => void uploadDocument(event.target.files?.[0] ?? null)}
                disabled={uploading}
              />
            </FormField>

            {form.identificationDocumentUrl ? (
              <div className="muted tiny" style={{ marginTop: 8 }}>
                Document uploaded: <a href={form.identificationDocumentUrl} target="_blank" rel="noreferrer">{form.identificationDocumentUrl}</a>
              </div>
            ) : null}
          </section>

          <button type="submit" className="draw-button" disabled={saving || uploading}>
            {saving ? "Saving..." : primaryActionLabel}
          </button>
        </form>
      ) : null}

      {hasAccess && error ? <p className="error">{error}</p> : null}
      {message ? <p className="badge">{message}</p> : null}
        </>
      )}
    </section>
  );
}
