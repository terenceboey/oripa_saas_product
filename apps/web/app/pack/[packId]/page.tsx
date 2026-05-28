"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useBackForwardRefresh } from "../../../lib/use-back-forward-refresh";

type Prize = {
  id: string;
  label: string;
  imageUrl?: string | null;
  estimatedValue: number;
  remainingStock: number;
  dropRatePercent?: number;
};

type Pack = {
  id: string;
  title: string;
  pricePoints: number;
  remainingStock: number;
  totalStock: number;
  limitedLabel?: string | null;
  prizes: Prize[];
};

type Wallet = {
  id: string;
  balancePoints: number;
};

type DrawResult = {
  packId: string;
  quantity: number;
  totalCost: number;
  draws: Array<{
    drawId: string;
    prizeId: string | null;
    prizeLabel?: string | null;
    prizeImageUrl?: string | null;
  }>;
};

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const vendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "demo.localhost";
const defaultPokemonCardImage = "https://archives.bulbagarden.net/media/upload/1/17/Cardback.jpg";

export default function PackDrawPage() {
  const params = useParams<{ packId: string }>();
  const packId = String(params?.packId ?? "");

  const headers = useMemo(() => ({ "x-vendor-host": vendorHost }), []);

  const [pack, setPack] = useState<Pack | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [lastDraw, setLastDraw] = useState<DrawResult | null>(null);

  const loadData = useCallback(async () => {
    if (!packId) return;
    setLoading(true);
    setError(null);

    try {
      const [packResponse, walletResponse] = await Promise.all([
        fetch(`${apiBase}/v1/packs/${packId}`, { headers, cache: "no-store" }),
        fetch(`${apiBase}/v1/wallet`, { headers, cache: "no-store" }),
      ]);

      if (!packResponse.ok) {
        const payload = await packResponse.json().catch(() => ({}));
        throw new Error(payload.error ?? "Pack not found");
      }
      if (!walletResponse.ok) throw new Error("Failed to load wallet");

      const packPayload = await packResponse.json();
      const walletPayload = await walletResponse.json();

      setPack(packPayload.pack);
      setWallet(walletPayload.wallet);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pack");
    } finally {
      setLoading(false);
    }
  }, [headers, packId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useBackForwardRefresh(loadData);

  async function handleDraw(quantity: number) {
    if (!pack) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("oripa_access_token") : null;
    if (!token) {
      setError("Please login before drawing.");
      return;
    }

    setDrawing(true);
    setError(null);

    const idempotencyKey = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

    try {
      const response = await fetch(`${apiBase}/v1/draws`, {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/json",
          "x-idempotency-key": idempotencyKey,
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ packId: pack.id, quantity }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Draw failed");

      setLastDraw(payload);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draw failed");
    } finally {
      setDrawing(false);
    }
  }

  return (
    <main className="container">
      <div className="pack-draw-header">
        <Link href="/" className="sort-pill">Back to Catalog</Link>
        <div className="actions">
          <Link href="/fairness-proofs" className="sort-pill">Fairness Proofs</Link>
          <div className="wallet-chip">Points: {wallet?.balancePoints?.toLocaleString() ?? "-"}</div>
        </div>
      </div>

      {loading ? <section className="card"><p className="muted">Loading pack...</p></section> : null}
      {!loading && !pack ? <section className="card"><p className="error">Pack not found</p></section> : null}

      {pack ? (
        <>
          <section className="card">
            <div className="pack-header">
              <h1>{pack.title}</h1>
              {pack.limitedLabel ? <span className="badge warn">{pack.limitedLabel}</span> : null}
            </div>
            <p className="muted remaining-text">Remaining {pack.remainingStock}/{pack.totalStock}</p>
            <div className="price-line">
              <span className="muted">1 draw</span>
              <strong>{pack.pricePoints.toLocaleString()} pts</strong>
            </div>

            <div className="actions">
              <button type="button" className="draw-button" disabled={drawing || pack.remainingStock < 1} onClick={() => handleDraw(1)}>Draw</button>
              <button type="button" className="draw-button alt" disabled={drawing || pack.remainingStock < 10} onClick={() => handleDraw(10)}>10 Draws</button>
              <button type="button" className="draw-button alt-2" disabled={drawing || pack.remainingStock < 100} onClick={() => handleDraw(100)}>100 Draws</button>
            </div>
            {error ? <p className="error">{error}</p> : null}
          </section>

          <section className="card" style={{ marginTop: 12 }}>
            <h2>Card Preview</h2>
            <p className="muted">Each item can have vendor-uploaded art. Rates shown below are current weighted odds.</p>
            <div className="card-preview-grid">
              {pack.prizes.map((prize) => (
                <article key={prize.id} className="card-preview-item">
                  <img src={prize.imageUrl || defaultPokemonCardImage} alt={prize.label} />
                  <div className="card-preview-meta">
                    <strong>{prize.label}</strong>
                    <span className="muted tiny">Rate {(prize.dropRatePercent ?? 0).toFixed(4)}%</span>
                    <span className="muted tiny">Stock {prize.remainingStock}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {lastDraw ? (
            <section className="card" style={{ marginTop: 12 }}>
              <h3>Draw Result</h3>
              <p className="muted">Quantity {lastDraw.quantity} | Cost {lastDraw.totalCost.toLocaleString()} pts</p>
              <div className="draw-result-grid">
                {lastDraw.draws.map((draw) => (
                  <article key={draw.drawId} className="draw-result-item">
                    <img src={draw.prizeImageUrl || defaultPokemonCardImage} alt={draw.prizeLabel || "No Prize"} />
                    <div className="card-preview-meta">
                      <strong>{draw.prizeLabel || "No Prize"}</strong>
                      <span className="muted tiny">ID {draw.drawId.slice(0, 10)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}



