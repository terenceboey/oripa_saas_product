"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Container, Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";

type FairnessProofSummary = {
  drawOrderId: string;
  algorithmVersion: string;
  serverSeedHash: string;
  revealedServerSeed: string;
  clientSeed: string;
  nonceBase: string;
  quantity: number;
  poolSnapshotHash: string;
  createdAt: string;
};

type FairnessSelection = {
  id: string;
  drawSequence: number;
  hmacHex: string;
  randomFloat: string;
  randomWeightValue: number;
  totalWeightAtDraw: number;
  tierLabel?: string | null;
  tierLowerBound?: number | null;
  tierUpperBound?: number | null;
  rowSeedHex: string;
  chosenPackPrizeId?: string | null;
  eligiblePrizeIds: string[];
};

type FairnessProofDetail = {
  id: string;
  drawOrderId: string;
  algorithmVersion: string;
  serverSeedHash: string;
  revealedServerSeed: string;
  clientSeed: string;
  nonceBase: string;
  quantity: number;
  poolSnapshotHash: string;
  createdAt: string;
  selections: FairnessSelection[];
};

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const clientPageHeader = { "x-client-page": "/fairness-proofs" };

export default function FairnessProofsPage() {
  const runtimeVendorHost = useMemo(() => {
    if (typeof window !== "undefined" && window.location?.host) return window.location.host.toLowerCase();
    return configuredVendorHost;
  }, []);
  const headers = useMemo(() => ({ ...clientPageHeader }), [runtimeVendorHost]);

  const [proofs, setProofs] = useState<FairnessProofSummary[]>([]);
  const [detailsByOrderId, setDetailsByOrderId] = useState<Record<string, FairnessProofDetail>>({});
  const [howToVerifyByOrderId, setHowToVerifyByOrderId] = useState<Record<string, string[]>>({});
  const [loadingByOrderId, setLoadingByOrderId] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummaries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/v1/fairness-proofs?limit=100`, {
        headers,
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to load fairness proofs");
      setProofs(payload.proofs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load fairness proofs");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    void loadSummaries();
  }, [loadSummaries]);

  async function loadDetail(drawOrderId: string) {
    if (detailsByOrderId[drawOrderId] || loadingByOrderId[drawOrderId]) return;

    setLoadingByOrderId((prev) => ({ ...prev, [drawOrderId]: true }));
    try {
      const response = await fetch(`${apiBase}/v1/draws/${drawOrderId}/proof`, {
        headers,
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to load proof detail");

      setDetailsByOrderId((prev) => ({ ...prev, [drawOrderId]: payload.proof }));
      setHowToVerifyByOrderId((prev) => ({ ...prev, [drawOrderId]: payload.howToVerify ?? [] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load proof detail");
    } finally {
      setLoadingByOrderId((prev) => ({ ...prev, [drawOrderId]: false }));
    }
  }

  function formatTime(value: string) {
    return new Date(value).toLocaleString();
  }

  return (
    <Container size="lg" py="lg">
      <Stack gap="md">
        <Paper withBorder radius="xl" p="lg" shadow="sm">
          <Group justify="space-between" align="center" wrap="wrap">
            <div>
              <Title order={1}>Your Fairness Proofs</Title>
              <Text c="dimmed">Last 100 proofs. Each proof is reproducible via server/client seeds.</Text>
            </div>
            <Group gap="xs" wrap="wrap">
              <Button component={Link} href="/" variant="light">
                Back to Catalog
              </Button>
              <Button onClick={() => void loadSummaries()} loading={loading} variant="outline">
                Refresh
              </Button>
            </Group>
          </Group>
        </Paper>

        {error ? <Alert color="red" variant="light">{error}</Alert> : null}

        <Stack gap="md">
          {proofs.map((proof) => {
            const detail = detailsByOrderId[proof.drawOrderId];
            const howToVerify = howToVerifyByOrderId[proof.drawOrderId] ?? [];
            const loadingDetail = loadingByOrderId[proof.drawOrderId];

            return (
              <Card withBorder radius="xl" shadow="sm" key={proof.drawOrderId} padding="lg">
                <Stack gap="md">
                  <Group justify="space-between" align="start" wrap="wrap">
                    <div>
                      <Title order={3} size="h4">{formatTime(proof.createdAt)}</Title>
                      <Text size="sm" c="dimmed">Claw: {proof.drawOrderId.slice(0, 12)}</Text>
                    </div>
                    <Text size="sm" c="dimmed">Quantity: {proof.quantity}</Text>
                  </Group>

                  <SimpleProofGrid proof={proof} />

                  <details onToggle={(e) => {
                    if ((e.currentTarget as HTMLDetailsElement).open) void loadDetail(proof.drawOrderId);
                  }}>
                    <summary>View selections JSON</summary>
                    {loadingDetail ? <Text size="sm" c="dimmed">Loading proof detail...</Text> : null}
                    <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}>{JSON.stringify(detail?.selections ?? [], null, 2)}</pre>
                  </details>

                  <details onToggle={(e) => {
                    if ((e.currentTarget as HTMLDetailsElement).open) void loadDetail(proof.drawOrderId);
                  }}>
                    <summary>How to verify</summary>
                    {loadingDetail ? <Text size="sm" c="dimmed">Loading verification steps...</Text> : null}
                    <ol>
                      {howToVerify.map((line) => <li key={line}>{line}</li>)}
                    </ol>
                    <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}>{`const crypto = require("crypto");

function sha256Hex(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function hmacSha256Hex(key, msg) {
  return crypto.createHmac("sha256", key).update(msg).digest("hex");
}

function hexToFloat01(hex) {
  const slice = hex.slice(0, 13);
  const intVal = parseInt(slice, 16);
  return intVal / Math.pow(2, 52);
}

// verify commitment
// sha256Hex(serverSeed) === serverSeedHash`}</pre>
                  </details>
                </Stack>
              </Card>
            );
          })}

          {!loading && proofs.length === 0 ? (
            <Paper withBorder radius="xl" p="lg" shadow="sm">
              <Text>No fairness proofs yet. Draw a pack first and they will appear here.</Text>
            </Paper>
          ) : null}
        </Stack>
      </Stack>
    </Container>
  );
}

function SimpleProofGrid({ proof }: { proof: FairnessProofSummary }) {
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
      <Paper withBorder radius="lg" p="md">
        <Stack gap={4}>
          <Text size="sm"><strong>Version:</strong> v1</Text>
          <Text size="sm"><strong>Algorithm:</strong> {proof.algorithmVersion}</Text>
          <Text size="sm"><strong>ServerSeedHash:</strong> {proof.serverSeedHash}</Text>
          <Text size="sm"><strong>ClientSeed:</strong> {proof.clientSeed}</Text>
          <Text size="sm"><strong>Session:</strong> {proof.nonceBase}</Text>
        </Stack>
      </Paper>
      <Paper withBorder radius="lg" p="md">
        <Stack gap={4}>
          <Text size="sm"><strong>ServerSeed:</strong> {proof.revealedServerSeed}</Text>
          <Text size="sm"><strong>Amount:</strong> {proof.quantity}</Text>
          <Text size="sm"><strong>PoolSnapshotHash:</strong> {proof.poolSnapshotHash}</Text>
        </Stack>
      </Paper>
    </SimpleGrid>
  );
}
