"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Anchor, Badge, Button, Container, FileButton, Group, Paper, Select, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
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

  const countryData = COUNTRY_OPTIONS.map((country) => ({ value: country.code, label: country.name }));

  return (
    <Container size="lg" py="xl">
      <Paper radius="xl" p="xl" shadow="md" withBorder>
        {!loading && !hasAccess ? (
          <Stack gap="md">
            <Title order={1}>Vendor Access Required</Title>
            <Alert color="red">{error ?? "You do not have access to this vendor page."}</Alert>
          </Stack>
        ) : (
          <Stack gap="lg">
            <div>
              <Title order={1}>{title}</Title>
              <Text c="dimmed" mt={6}>{description}</Text>
              {note ? <Badge variant="light" mt="sm">{note}</Badge> : null}
              {applicationStatus ? <Text size="sm" c="dimmed" mt="xs">Application status: <strong>{applicationStatus}</strong></Text> : null}
              {loading ? <Text c="dimmed" mt="xs">Loading vendor details...</Text> : null}
            </div>

            {hasAccess ? (
              <form onSubmit={saveApplication}>
                <Stack gap="lg">
                  <Paper withBorder radius="lg" p="md">
                    <Stack gap="md">
                      <Title order={2} size="h3">Business information</Title>
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                        <TextInput label="Entity name" value={form.entityName} onChange={(event) => updateField("entityName", event.target.value)} placeholder="Entity name" required />
                        <Select label="Years of operations" value={form.yearsOfOperations || null} onChange={(value) => updateField("yearsOfOperations", (value ?? "") as FormState["yearsOfOperations"])} data={[
                          { value: "LT_1", label: "0-1 years" },
                          { value: "ONE_TO_THREE", label: "1-3 years" },
                          { value: "THREE_TO_FIVE", label: "3-5 years" },
                          { value: "FIVE_PLUS", label: "5+ years" },
                        ]} required />
                        <TextInput label="Business registration number / tax ID (optional)" value={form.businessRegistrationNumber} onChange={(event) => updateField("businessRegistrationNumber", event.target.value)} placeholder="Business registration number / tax ID" />
                        <TextInput label="Business email (optional)" type="email" value={form.businessEmail} onChange={(event) => updateField("businessEmail", event.target.value)} placeholder="Business email" />
                        <TextInput label="Contact phone number (optional)" value={form.contactPhoneNumber} onChange={(event) => updateField("contactPhoneNumber", event.target.value)} placeholder="Contact phone number" />
                      </SimpleGrid>
                    </Stack>
                  </Paper>

                  <Paper withBorder radius="lg" p="md">
                    <Stack gap="md">
                      <Title order={2} size="h3">Business address</Title>
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                        <TextInput label="Address line 1" value={form.registeredBusinessAddressLine1} onChange={(event) => updateField("registeredBusinessAddressLine1", event.target.value)} placeholder="Street address, building, or unit" required />
                        <TextInput label="Address line 2 (optional)" value={form.registeredBusinessAddressLine2} onChange={(event) => updateField("registeredBusinessAddressLine2", event.target.value)} placeholder="Suite, floor, or apartment" />
                        <TextInput label="City" value={form.registeredBusinessAddressCity} onChange={(event) => updateField("registeredBusinessAddressCity", event.target.value)} placeholder="City" required />
                        <TextInput label="State / Province" value={form.registeredBusinessAddressStateProvince} onChange={(event) => updateField("registeredBusinessAddressStateProvince", event.target.value)} placeholder="State or province" required />
                        <TextInput label="Postal code" value={form.registeredBusinessAddressPostalCode} onChange={(event) => updateField("registeredBusinessAddressPostalCode", event.target.value)} placeholder="Postal code" required />
                        <Select label="Country" value={form.registeredBusinessAddressCountry || null} onChange={(value) => updateField("registeredBusinessAddressCountry", value ?? "")} data={countryData} searchable required />
                      </SimpleGrid>
                    </Stack>
                  </Paper>

                  <Paper withBorder radius="lg" p="md">
                    <Stack gap="md">
                      <Title order={2} size="h3">Primary contact and identity</Title>
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                        <TextInput label="Person in charge" value={form.personInCharge} onChange={(event) => updateField("personInCharge", event.target.value)} placeholder="Person in charge" required />
                        <TextInput label="Person in charge date of birth" type="date" value={form.personInChargeDateOfBirth} onChange={(event) => updateField("personInChargeDateOfBirth", event.target.value)} required />
                        <Select label="Person in charge country" value={form.personInChargeCountry || null} onChange={(value) => updateField("personInChargeCountry", value ?? "")} data={countryData} searchable required />
                        <Select label="Identifying document type" value={form.identificationDocumentType || null} onChange={(value) => updateField("identificationDocumentType", (value ?? "") as FormState["identificationDocumentType"])} data={[
                          { value: "PASSPORT", label: "Passport" },
                          { value: "DRIVING_LICENCE", label: "Driving licence" },
                        ]} required />
                      </SimpleGrid>
                    </Stack>
                  </Paper>

                  <Paper withBorder radius="lg" p="md">
                    <Stack gap="md">
                      <Title order={2} size="h3">Online presence</Title>
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                        <TextInput label="Business website URL" type="url" value={form.businessWebsiteUrl} onChange={(event) => updateField("businessWebsiteUrl", event.target.value)} placeholder="https://example.com" />
                        <TextInput label="Facebook URL" type="url" value={form.facebookUrl} onChange={(event) => updateField("facebookUrl", event.target.value)} placeholder="https://facebook.com/..." />
                        <TextInput label="Instagram URL" type="url" value={form.instagramUrl} onChange={(event) => updateField("instagramUrl", event.target.value)} placeholder="https://instagram.com/..." />
                        <TextInput label="TikTok URL" type="url" value={form.tiktokUrl} onChange={(event) => updateField("tiktokUrl", event.target.value)} placeholder="https://www.tiktok.com/..." />
                        <TextInput label="X URL" type="url" value={form.xUrl} onChange={(event) => updateField("xUrl", event.target.value)} placeholder="https://x.com/..." />
                        <TextInput label="LinkedIn URL" type="url" value={form.linkedinUrl} onChange={(event) => updateField("linkedinUrl", event.target.value)} placeholder="https://linkedin.com/..." />
                        <TextInput label="YouTube URL" type="url" value={form.youtubeUrl} onChange={(event) => updateField("youtubeUrl", event.target.value)} placeholder="https://youtube.com/..." />
                      </SimpleGrid>
                    </Stack>
                  </Paper>

                  <Paper withBorder radius="lg" p="md">
                    <Stack gap="md">
                      <Title order={2} size="h3">Payout details</Title>
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                        <TextInput label="Account holder name" value={form.payoutBankAccountHolderName} onChange={(event) => updateField("payoutBankAccountHolderName", event.target.value)} placeholder="Account holder name" required />
                        <TextInput label="Bank name" value={form.payoutBankName} onChange={(event) => updateField("payoutBankName", event.target.value)} placeholder="Bank name" required />
                        <Select label="Bank country" value={form.payoutBankCountry || null} onChange={(value) => updateField("payoutBankCountry", value ?? "")} data={countryData} searchable required />
                        <TextInput label="Account number" value={form.payoutBankAccountNumber} onChange={(event) => updateField("payoutBankAccountNumber", event.target.value)} placeholder="Account number" />
                        <TextInput label="IBAN (optional)" value={form.payoutBankIban} onChange={(event) => updateField("payoutBankIban", event.target.value)} placeholder="IBAN" />
                        <TextInput label="SWIFT / BIC (optional)" value={form.payoutBankSwiftBic} onChange={(event) => updateField("payoutBankSwiftBic", event.target.value)} placeholder="SWIFT / BIC" />
                        <TextInput label="Branch code (optional)" value={form.payoutBankBranchCode} onChange={(event) => updateField("payoutBankBranchCode", event.target.value)} placeholder="Branch code" />
                      </SimpleGrid>
                    </Stack>
                  </Paper>

                  <Paper withBorder radius="lg" p="md">
                    <Stack gap="md">
                      <Title order={2} size="h3">Supporting document</Title>
                      <FileButton onChange={(file) => void uploadDocument(file)} accept="image/png,image/jpeg,image/webp,application/pdf">
                        {(props) => <Button {...props} variant="light" disabled={uploading}>Upload identifying document</Button>}
                      </FileButton>
                      {form.identificationDocumentUrl ? (
                        <Text size="sm" c="dimmed">
                          Document uploaded: <Anchor href={form.identificationDocumentUrl} target="_blank" rel="noreferrer">Open document</Anchor>
                        </Text>
                      ) : null}
                    </Stack>
                  </Paper>

                  <Button type="submit" loading={saving || uploading} radius="md">
                    {saving ? "Saving..." : primaryActionLabel}
                  </Button>
                </Stack>
              </form>
            ) : null}

            {hasAccess && error ? <Alert color="red">{error}</Alert> : null}
            {message ? <Alert color="green">{message}</Alert> : null}
          </Stack>
        )}
      </Paper>
    </Container>
  );
}
