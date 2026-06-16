"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiBaseUrl, apiFetch } from "../../../../lib/api";
import { Alert, Badge, Button, Card, Container, Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";

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
    <Container size="xl" py="lg">
      <Stack gap="md">
        <Paper withBorder radius="xl" p="md" shadow="sm">
          <Group justify="space-between" align="center" wrap="wrap">
            <Group gap="xs" wrap="wrap">
              <Button component={Link} href="/super-admin" variant="light">
                Back to Dashboard
              </Button>
              <Button component={Link} href="/" variant="subtle">
                Home
              </Button>
            </Group>
            <Badge variant="light">Risk {vendor?.riskLevel ?? "-"}</Badge>
          </Group>
        </Paper>

        <Card withBorder radius="xl" p="lg" shadow="sm">
          <Stack gap="sm">
            <Title order={1}>Vendor Review</Title>
            <Text c="dimmed">Inspect and update vendor application state.</Text>
            {loading ? <Text c="dimmed">Loading vendor...</Text> : null}
            {error ? <Alert color="red" variant="light">{error}</Alert> : null}
          </Stack>
        </Card>

        {vendor ? (
          <Stack gap="md">
            <Card withBorder radius="xl" p="lg" shadow="sm">
              <Stack gap="md">
                <Group justify="space-between" align="start" wrap="wrap">
                  <div>
                    <Title order={2}>{vendor.name}</Title>
                    <Text c="dimmed">{vendor.host} | {vendor.applicationStatus} | {vendor.isActive ? "active" : "inactive"}</Text>
                  </div>
                  <Badge variant="light">Risk {vendor.riskLevel}</Badge>
                </Group>

                <SimpleGrid cols={{ base: 2, md: 3 }} spacing="sm">
                  <Card withBorder radius="md" p="sm"><Text size="sm">Entity: {vendor.entityName ?? "-"}</Text></Card>
                  <Card withBorder radius="md" p="sm"><Text size="sm">PIC: {vendor.personInCharge ?? "-"}</Text></Card>
                  <Card withBorder radius="md" p="sm"><Text size="sm">Years: {vendor.yearsOfOperations ?? "-"}</Text></Card>
                  <Card withBorder radius="md" p="sm"><Text size="sm">Country: {vendor.personInChargeCountry ?? "-"}</Text></Card>
                  <Card withBorder radius="md" p="sm"><Text size="sm">Business Reg: {vendor.businessRegistrationNumber ?? "-"}</Text></Card>
                  <Card withBorder radius="md" p="sm"><Text size="sm">Phone: {vendor.contactPhoneNumber ?? "-"}</Text></Card>
                </SimpleGrid>

                <Stack gap={4}>
                  <Text size="sm"><strong>Business email:</strong> {vendor.businessEmail ?? "-"}</Text>
                  <Text size="sm"><strong>Website/social:</strong> {formatSocial(vendor)}</Text>
                  <Text size="sm"><strong>Registered address:</strong> {formatAddress(vendor)}</Text>
                  <Text size="sm"><strong>Payout details:</strong> {formatBank(vendor)}</Text>
                  <Text size="sm"><strong>Document:</strong> {vendor.identificationDocumentType ?? "-"}{vendor.identificationDocumentUrl ? ` | ${vendor.identificationDocumentUrl}` : ""}</Text>
                  <Text size="sm"><strong>Submitted:</strong> {vendor.applicationSubmittedAt ?? "-"}</Text>
                  <Text size="sm"><strong>Reviewed:</strong> {vendor.applicationReviewedAt ?? "-"}</Text>
                  <Text size="sm"><strong>Notes:</strong> {vendor.applicationReviewNotes ?? "-"}</Text>
                </Stack>

                <Group gap="xs" wrap="wrap">
                  <Button loading={actionLoading === "approve"} onClick={() => void reviewVendor("approve")}>Approve</Button>
                  <Button variant="outline" color="red" loading={actionLoading === "reject"} onClick={() => void reviewVendor("reject")}>Reject</Button>
                </Group>
              </Stack>
            </Card>

            <Card withBorder radius="xl" p="lg" shadow="sm">
              <Stack gap="md">
                <Title order={2} size="h3">Members</Title>
                {vendor.members.length ? (
                  <Stack gap="sm">
                    {vendor.members.map((member) => (
                      <Card key={member.id} withBorder radius="md" p="md">
                        <Stack gap={4}>
                          <Text fw={600}>{member.user.email}</Text>
                          <Text size="sm" c="dimmed">Role: {member.role} | {member.isActive ? "active" : "inactive"}</Text>
                          <Text size="sm" c="dimmed">Display name: {member.user.displayName ?? "-"}</Text>
                          <Text size="sm" c="dimmed">Status: {member.user.status}</Text>
                        </Stack>
                      </Card>
                    ))}
                  </Stack>
                ) : (
                  <Text c="dimmed">No members found.</Text>
                )}
              </Stack>
            </Card>
          </Stack>
        ) : null}
      </Stack>
    </Container>
  );
}
