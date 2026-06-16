"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiBaseUrl, apiFetch } from "../../lib/api";
import { Alert, Badge, Button, Card, Container, Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";

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
  identificationDocumentType?: string | null;
  identificationDocumentUrl?: string | null;
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
    platformFeePoints: number;
    platformFeeCurrency: number;
  };
  pendingVendors: SuperAdminVendor[];
};

function formatAddress(vendor: SuperAdminVendor) {
  const parts = [
    vendor.registeredBusinessAddressLine1,
    vendor.registeredBusinessAddressLine2,
    [vendor.registeredBusinessAddressCity, vendor.registeredBusinessAddressStateProvince].filter(Boolean).join(", ") || null,
    vendor.registeredBusinessAddressPostalCode,
    vendor.registeredBusinessAddressCountry,
  ].map((part) => String(part ?? "").trim()).filter(Boolean);
  return parts.length ? parts.join(" | ") : "-";
}

function formatBank(vendor: SuperAdminVendor) {
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

function formatSocial(vendor: SuperAdminVendor) {
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
      { label: "Platform Fee Points", value: summary?.platformFeePoints ?? 0 },
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
    <Container size="xl" py="lg">
      <Stack gap="md">
        <Paper withBorder radius="xl" p="md" shadow="sm">
          <Group justify="space-between" align="center" wrap="wrap">
            <div>
              <Title order={1}>Super Admin</Title>
              <Text c="dimmed">Review vendor approvals, inspect sensitive vendor details, and manage the platform.</Text>
            </div>
            <Group gap="xs" wrap="wrap">
              <Button component={Link} href="/" variant="light">
                Back to Home
              </Button>
              <Button onClick={() => void logout()} variant="outline">
                Logout
              </Button>
            </Group>
          </Group>
        </Paper>

        <Paper withBorder radius="xl" p="lg" shadow="sm">
          <SimpleGrid cols={{ base: 2, md: 3, lg: 4 }} spacing="md">
            {summaryCards.map((card) => (
              <Card key={card.label} withBorder radius="lg" p="md">
                <Text size="sm" c="dimmed">{card.label}</Text>
                <Title order={3}>{card.value}</Title>
              </Card>
            ))}
            <Card withBorder radius="lg" p="md">
              <Text size="sm" c="dimmed">Platform Fee Currency</Text>
              <Title order={3}>{dashboard?.summary?.platformFeeCurrency?.toFixed(2) ?? "0.00"}</Title>
            </Card>
          </SimpleGrid>
        </Paper>

        {loading ? <Text c="dimmed">Loading dashboard...</Text> : null}
        {error ? <Alert color="red" variant="light">{error}</Alert> : null}

        <Card withBorder radius="xl" p="lg" shadow="sm">
          <Stack gap="md">
            <Title order={2} size="h3">Pending Vendor Applications</Title>
            {dashboard?.pendingVendors.length ? (
              <Stack gap="md">
                {dashboard.pendingVendors.map((vendor) => (
                  <Card key={vendor.id} withBorder radius="lg" p="md">
                    <Stack gap="md">
                      <Group justify="space-between" align="start" wrap="wrap">
                        <div>
                          <Title order={3} size="h4">{vendor.name}</Title>
                          <Text c="dimmed" size="sm">{vendor.host} | {vendor.applicationStatus}</Text>
                        </div>
                        <Badge variant="light">{vendor.isActive ? "Active" : "Inactive"}</Badge>
                      </Group>

                      <SimpleGrid cols={{ base: 2, md: 3 }} spacing="sm">
                        <Card withBorder radius="md" p="sm"><Text size="sm">Entity: {vendor.entityName ?? "-"}</Text></Card>
                        <Card withBorder radius="md" p="sm"><Text size="sm">PIC: {vendor.personInCharge ?? "-"}</Text></Card>
                        <Card withBorder radius="md" p="sm"><Text size="sm">Country: {vendor.personInChargeCountry ?? "-"}</Text></Card>
                        <Card withBorder radius="md" p="sm"><Text size="sm">Business Reg: {vendor.businessRegistrationNumber ?? "-"}</Text></Card>
                        <Card withBorder radius="md" p="sm"><Text size="sm">Phone: {vendor.contactPhoneNumber ?? "-"}</Text></Card>
                        <Card withBorder radius="md" p="sm"><Text size="sm">Risk: {vendor.riskLevel}</Text></Card>
                      </SimpleGrid>

                      <Stack gap={4}>
                        <Text size="sm"><strong>Business email:</strong> {vendor.businessEmail ?? "-"}</Text>
                        <Text size="sm"><strong>Contact phone:</strong> {vendor.contactPhoneNumber ?? "-"}</Text>
                        <Text size="sm"><strong>Website/social:</strong> {formatSocial(vendor)}</Text>
                        <Text size="sm"><strong>Registered address:</strong> {formatAddress(vendor)}</Text>
                        <Text size="sm"><strong>Payout details:</strong> {formatBank(vendor)}</Text>
                        <Text size="sm"><strong>Document:</strong> {vendor.identificationDocumentType ?? "-"}{vendor.identificationDocumentUrl ? ` | ${vendor.identificationDocumentUrl}` : ""}</Text>
                      </Stack>

                      <Group gap="xs" wrap="wrap">
                        <Button loading={actionLoading === vendor.id} onClick={() => void reviewVendor(vendor.id, "approve")}>
                          Approve
                        </Button>
                        <Button variant="outline" color="red" loading={actionLoading === vendor.id} onClick={() => void reviewVendor(vendor.id, "reject")}>
                          Reject
                        </Button>
                        <Button component={Link} href={`/super-admin/vendors/${vendor.id}`} variant="light">
                          Open
                        </Button>
                      </Group>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            ) : (
              <Text c="dimmed">No pending vendor applications right now.</Text>
            )}
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
