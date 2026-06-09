import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BUYBACK_POLICY_VERSION,
  BUYBACK_QUOTE_CURRENCY,
  DEFAULT_CUSTODY_PROVIDER,
  getCustodyProviderAdapter,
  listCustodyProviderAdapters,
} from "../src/lib/customer-custody";

const now = new Date("2026-06-09T12:00:00.000Z");
const valueAsOf = new Date("2026-06-09T11:00:00.000Z");
const heldItem = {
  id: "custody-internal-1",
  vendorId: "vendor-alpha",
  userId: "user-one",
  status: "HELD" as const,
  provider: "ORIPA_INTERNAL" as const,
  estimatedValue: 1000,
  estimatedValueSource: "vendor_comp",
  estimatedValueAsOf: valueAsOf,
  requests: [],
};

async function main() {
  assert.equal(DEFAULT_CUSTODY_PROVIDER, "ORIPA_INTERNAL", "existing custody flow must default to ORIPA_INTERNAL");

  const adapters = listCustodyProviderAdapters();
  assert.deepEqual(adapters.map((adapter) => adapter.provider), ["ORIPA_INTERNAL", "COLLECTOR_CRYPT", "PHYGITALS"]);
  assert.deepEqual(adapters.map((adapter) => [adapter.provider, adapter.configured]), [
    ["ORIPA_INTERNAL", true],
    ["COLLECTOR_CRYPT", false],
    ["PHYGITALS", false],
  ]);

  const internal = getCustodyProviderAdapter();
  assert.equal(internal.provider, "ORIPA_INTERNAL");
  assert.equal(internal.configured, true);
  const quote = await internal.quoteBuyback(heldItem, { now, buybackPercent: 65 });
  assert.equal(quote.ok, true);
  if (quote.ok) {
    assert.equal(quote.quoteAmount, 650);
    assert.equal(quote.quoteCurrency, BUYBACK_QUOTE_CURRENCY);
    assert.equal(quote.policyVersion, BUYBACK_POLICY_VERSION);
  }
  const redemption = await internal.requestRedemption({
    vendorId: "vendor-alpha",
    userId: "user-one",
    custodyItemId: heldItem.id,
    customerNote: "ship it",
  });
  assert.deepEqual(redemption, {
    provider: "ORIPA_INTERNAL",
    providerRequestId: null,
    status: "PENDING",
  });
  const synced = await internal.syncStatus({
    vendorId: "vendor-alpha",
    userId: "user-one",
    custodyItemId: heldItem.id,
    custodyRequestId: "request-1",
    currentStatus: "PENDING",
    now,
  });
  assert.equal(synced.provider, "ORIPA_INTERNAL");
  assert.equal(synced.status, "PENDING");
  assert.equal(synced.externalStatus, null);
  assert.equal(synced.syncedAt.toISOString(), now.toISOString());

  for (const provider of ["COLLECTOR_CRYPT", "PHYGITALS"] as const) {
    const adapter = getCustodyProviderAdapter(provider);
    assert.equal(adapter.configured, false, `${provider} must stay disabled until explicitly integrated`);
    await assert.rejects(
      () => adapter.quoteBuyback(heldItem, { now }),
      (error: unknown) => error instanceof Error && error.message === `${provider} custody provider is not configured for quoteBuyback`,
      `${provider} quoteBuyback must fail closed`,
    );
    await assert.rejects(
      () => adapter.requestRedemption({ vendorId: "vendor-alpha", userId: "user-one", custodyItemId: heldItem.id }),
      (error: unknown) => error instanceof Error && error.message === `${provider} custody provider is not configured for requestRedemption`,
      `${provider} requestRedemption must fail closed`,
    );
    await assert.rejects(
      () => adapter.syncStatus({ vendorId: "vendor-alpha", userId: "user-one", custodyItemId: heldItem.id, currentStatus: "PENDING" }),
      (error: unknown) => error instanceof Error && error.message === `${provider} custody provider is not configured for syncStatus`,
      `${provider} syncStatus must fail closed`,
    );
  }

  const source = readFileSync(join(process.cwd(), "src/lib/customer-custody.ts"), "utf8");
  assert.doesNotMatch(source, /https?:\/\//i, "provider adapter stubs must not embed real provider URLs");
  assert.doesNotMatch(source, /API[_-]?KEY|SECRET|TOKEN/i, "provider adapter stubs must not require credentials");

  console.log("custody provider adapter stubs ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
