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
  registeredBusinessAddress?: string | null;
  contactPhoneNumber?: string | null;
  businessEmail?: string | null;
  websiteOrSocialLinks?: string | null;
  payoutBankDetails?: string | null;
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

type FormState = {
  entityName: string;
  yearsOfOperations: "LT_1" | "ONE_TO_THREE" | "THREE_TO_FIVE" | "FIVE_PLUS" | "";
  personInCharge: string;
  personInChargeDateOfBirth: string;
  personInChargeCountry: string;
  identificationDocumentType: "PASSPORT" | "DRIVING_LICENCE" | "";
  identificationDocumentUrl: string;
  businessRegistrationNumber: string;
  registeredBusinessAddress: string;
  contactPhoneNumber: string;
  businessEmail: string;
  websiteOrSocialLinks: string;
  payoutBankDetails: string;
};

const DEFAULT_STATE: FormState = {
  entityName: "",
  yearsOfOperations: "",
  personInCharge: "",
  personInChargeDateOfBirth: "",
  personInChargeCountry: "",
  identificationDocumentType: "",
  identificationDocumentUrl: "",
  businessRegistrationNumber: "",
  registeredBusinessAddress: "",
  contactPhoneNumber: "",
  businessEmail: "",
  websiteOrSocialLinks: "",
  payoutBankDetails: "",
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

function normalizeDraft(input: Partial<FormState> | null | undefined): FormState {
  return {
    entityName: String(input?.entityName ?? ""),
    yearsOfOperations: (String(input?.yearsOfOperations ?? "") as FormState["yearsOfOperations"]) || "",
    personInCharge: String(input?.personInCharge ?? ""),
    personInChargeDateOfBirth: String(input?.personInChargeDateOfBirth ?? ""),
    personInChargeCountry: String(input?.personInChargeCountry ?? ""),
    identificationDocumentType: (String(input?.identificationDocumentType ?? "") as FormState["identificationDocumentType"]) || "",
    identificationDocumentUrl: String(input?.identificationDocumentUrl ?? ""),
    businessRegistrationNumber: String(input?.businessRegistrationNumber ?? ""),
    registeredBusinessAddress: String(input?.registeredBusinessAddress ?? ""),
    contactPhoneNumber: String(input?.contactPhoneNumber ?? ""),
    businessEmail: String(input?.businessEmail ?? ""),
    websiteOrSocialLinks: String(input?.websiteOrSocialLinks ?? ""),
    payoutBankDetails: String(input?.payoutBankDetails ?? ""),
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
          entityName: application.entityName ?? current.entityName,
          yearsOfOperations: (application.yearsOfOperations ?? current.yearsOfOperations) as FormState["yearsOfOperations"],
          personInCharge: application.personInCharge ?? current.personInCharge,
          personInChargeDateOfBirth: toDateInputValue(application.personInChargeDateOfBirth) || current.personInChargeDateOfBirth,
          personInChargeCountry: application.personInChargeCountry ?? current.personInChargeCountry,
          identificationDocumentType: (application.identificationDocumentType ?? current.identificationDocumentType) as FormState["identificationDocumentType"],
          identificationDocumentUrl: application.identificationDocumentUrl ?? current.identificationDocumentUrl,
          businessRegistrationNumber: application.businessRegistrationNumber ?? current.businessRegistrationNumber,
          registeredBusinessAddress: application.registeredBusinessAddress ?? current.registeredBusinessAddress,
          contactPhoneNumber: application.contactPhoneNumber ?? current.contactPhoneNumber,
          businessEmail: application.businessEmail ?? current.businessEmail,
          websiteOrSocialLinks: application.websiteOrSocialLinks ?? current.websiteOrSocialLinks,
          payoutBankDetails: application.payoutBankDetails ?? current.payoutBankDetails,
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

        <FormField label="Person in charge">
          <input value={form.personInCharge} onChange={(event) => updateField("personInCharge", event.target.value)} placeholder="Person in charge" required />
        </FormField>

        <FormField label="Person in charge date of birth">
          <input type="date" value={form.personInChargeDateOfBirth} onChange={(event) => updateField("personInChargeDateOfBirth", event.target.value)} required />
        </FormField>

        <FormField label="Country">
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

        <FormField label="Business registration number / tax ID (optional)">
          <input value={form.businessRegistrationNumber} onChange={(event) => updateField("businessRegistrationNumber", event.target.value)} placeholder="Business registration number / tax ID" />
        </FormField>

        <FormField label="Registered business address (optional)">
          <textarea
            value={form.registeredBusinessAddress}
            onChange={(event) => updateField("registeredBusinessAddress", event.target.value)}
            placeholder="Registered business address"
            rows={3}
          />
        </FormField>

        <FormField label="Contact phone number (optional)">
          <input value={form.contactPhoneNumber} onChange={(event) => updateField("contactPhoneNumber", event.target.value)} placeholder="Contact phone number" />
        </FormField>

        <FormField label="Business email (optional)">
          <input type="email" value={form.businessEmail} onChange={(event) => updateField("businessEmail", event.target.value)} placeholder="Business email" />
        </FormField>

        <FormField label="Website or social links (optional)">
          <textarea
            value={form.websiteOrSocialLinks}
            onChange={(event) => updateField("websiteOrSocialLinks", event.target.value)}
            placeholder="One website or social link per line"
            rows={3}
          />
        </FormField>

        <FormField label="Payout / bank details (optional)">
          <textarea
            value={form.payoutBankDetails}
            onChange={(event) => updateField("payoutBankDetails", event.target.value)}
            placeholder="Bank name, account name, account number, SWIFT/BIC, or other payout details"
            rows={4}
          />
        </FormField>

        <FormField label="Upload identifying document">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            onChange={(event) => void uploadDocument(event.target.files?.[0] ?? null)}
            disabled={uploading}
          />
        </FormField>

        {form.identificationDocumentUrl ? (
          <div className="muted tiny">
            Document uploaded: <a href={form.identificationDocumentUrl} target="_blank" rel="noreferrer">{form.identificationDocumentUrl}</a>
          </div>
        ) : null}

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
