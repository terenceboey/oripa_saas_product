"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

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
  const headers = useMemo(() => ({ "x-vendor-host": runtimeVendorHost, ...clientPageHeader }), [runtimeVendorHost]);

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
    <main className="container fairness-page">
      <header className="site-header">
        <div className="brand-text">
          <strong>Your Fairness Proofs</strong>
          <span>Last 100 proofs. Each proof is reproducible via server/client seeds.</span>
        </div>
        <div className="actions">
          <Link href="/" className="sort-pill">Back to Catalog</Link>
          <button type="button" className="sort-pill" onClick={() => void loadSummaries()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <section className="fairness-list">
        {proofs.map((proof) => {
          const detail = detailsByOrderId[proof.drawOrderId];
          const howToVerify = howToVerifyByOrderId[proof.drawOrderId] ?? [];
          const loadingDetail = loadingByOrderId[proof.drawOrderId];

          return (
            <article className="fairness-card" key={proof.drawOrderId}>
              <div className="fairness-topline">
                <strong>{formatTime(proof.createdAt)}</strong>
                <span>Claw: {proof.drawOrderId.slice(0, 12)}</span>
              </div>

              <div className="fairness-grid">
                <div>
                  <div><strong>Version:</strong> v1</div>
                  <div><strong>Algorithm:</strong> {proof.algorithmVersion}</div>
                  <div><strong>ServerSeedHash:</strong> {proof.serverSeedHash}</div>
                  <div><strong>ClientSeed:</strong> {proof.clientSeed}</div>
                  <div><strong>Session:</strong> {proof.nonceBase}</div>
                </div>
                <div>
                  <div><strong>ServerSeed:</strong> {proof.revealedServerSeed}</div>
                  <div><strong>Amount:</strong> {proof.quantity}</div>
                  <div><strong>PoolSnapshotHash:</strong> {proof.poolSnapshotHash}</div>
                </div>
              </div>

              <details className="fairness-details" onToggle={(e) => {
                if ((e.currentTarget as HTMLDetailsElement).open) {
                  void loadDetail(proof.drawOrderId);
                }
              }}>
                <summary>View selections JSON</summary>
                {loadingDetail ? <p className="muted">Loading proof detail...</p> : null}
                <pre className="fairness-json">{JSON.stringify(detail?.selections ?? [], null, 2)}</pre>
              </details>

              <details className="fairness-details" onToggle={(e) => {
                if ((e.currentTarget as HTMLDetailsElement).open) {
                  void loadDetail(proof.drawOrderId);
                }
              }}>
                <summary>How to verify</summary>
                {loadingDetail ? <p className="muted">Loading verification steps...</p> : null}
                <ol className="fairness-verify-list">
                  {howToVerify.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ol>
                <pre className="fairness-json">{`const crypto = require("crypto");

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
            </article>
          );
        })}

        {!loading && proofs.length === 0 ? (
          <article className="fairness-card">
            <p>No fairness proofs yet. Draw a pack first and they will appear here.</p>
          </article>
        ) : null}
      </section>
    </main>
  );
}
