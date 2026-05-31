#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env'));
loadEnvFile(path.resolve(process.cwd(), 'apps/api/.env'));

const prisma = new PrismaClient();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const EXPECTED_COLUMNS = {
  CatalogSet: ['sourceCategoryId', 'productCount', 'sourcePayload', 'reviewStatus', 'logoImageUrl', 'symbolImageUrl', 'bannerImageUrl'],
  CatalogItem: ['catalogSetId', 'sourcePayload', 'itemType'],
  CatalogSealedProduct: ['sourceCategoryId', 'catalogSetId', 'sourcePayload', 'imageUrl'],
  PackPrize: ['catalogItemId', 'catalogSource', 'catalogSourceItemId', 'catalogSnapshot'],
  VendorInventoryItem: ['catalogItemId', 'customItemId', 'quantityTotal', 'quantityHeld', 'quantitySold'],
};

async function q(sql) {
  return prisma.$queryRawUnsafe(sql);
}

async function tableColumns(table) {
  return q(`select column_name from information_schema.columns where table_schema='public' and table_name='${table}' order by ordinal_position`);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for read-only preflight');
  const columns = {};
  const missingColumns = [];
  for (const [table, expected] of Object.entries(EXPECTED_COLUMNS)) {
    const rows = await tableColumns(table);
    const present = new Set(rows.map((row) => row.column_name));
    columns[table] = rows.map((row) => row.column_name);
    for (const col of expected) {
      if (!present.has(col)) missingColumns.push(`${table}.${col}`);
    }
  }

  const counts = {
    catalogSetMetadata: await q(`
      select count(*)::bigint total,
        sum(case when "sourceCategoryId" is null then 1 else 0 end)::bigint missing_source_category_id,
        sum(case when "productCount" is null then 1 else 0 end)::bigint missing_product_count,
        sum(case when "sourcePayload" is null then 1 else 0 end)::bigint missing_source_payload
      from "CatalogSet"
    `),
    catalogSearchShape: await q(`
      select "itemType", count(*)::bigint total
      from "CatalogItem"
      group by "itemType"
      order by "itemType"
    `),
    packPrizeSnapshots: await q(`
      select count(*)::bigint total,
        sum(case when "catalogItemId" is not null or "catalogSourceItemId" is not null then 1 else 0 end)::bigint catalog_linked,
        sum(case when ("catalogItemId" is not null or "catalogSourceItemId" is not null) and "catalogSnapshot" is null then 1 else 0 end)::bigint linked_missing_snapshot
      from "PackPrize"
    `),
    vendorInventory: await q(`select count(*)::bigint total from "VendorInventoryItem"`),
  };

  const apiPackage = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'apps/api/package.json'), 'utf8'));
  const requiredScripts = ['test:catalog:search-contract', 'test:packs:catalog-snapshots', 'test:catalog:live-db-remediation', 'test:catalog:live-db-audit-classification'];
  const missingScripts = requiredScripts.filter((script) => !apiPackage.scripts || !apiPackage.scripts[script]);
  const result = {
    stamp,
    readOnly: true,
    databaseHost: (() => { try { return new URL(process.env.DATABASE_URL).host; } catch { return 'unknown'; } })(),
    missingColumns,
    missingScripts,
    counts,
    pass: missingColumns.length === 0 && missingScripts.length === 0,
  };

  const outDir = path.resolve(process.cwd(), 'docs/plans');
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, `live-db-gap-preflight-${stamp}.json`);
  const mdPath = path.join(outDir, `live-db-gap-preflight-${stamp}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(result, (_k, v) => (typeof v === 'bigint' ? Number(v) : v), 2));
  fs.writeFileSync(mdPath, `# Live DB gap preflight — ${stamp}\n\nRead-only: yes\n\nPass: **${result.pass ? 'YES' : 'NO'}**\n\nMissing columns: ${missingColumns.length ? missingColumns.join(', ') : 'none'}\n\nMissing package scripts: ${missingScripts.length ? missingScripts.join(', ') : 'none'}\n\nJSON evidence: \`${path.relative(process.cwd(), jsonPath)}\`\n`);
  console.log(JSON.stringify({ ...result, jsonPath, mdPath }, (_k, v) => (typeof v === 'bigint' ? Number(v) : v), 2));
  if (!result.pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
