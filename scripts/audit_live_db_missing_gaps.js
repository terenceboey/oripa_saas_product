const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function jsonReplacer(_key, value) {
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value.toISOString();
  return value;
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function asTable(rows) {
  if (!rows || rows.length === 0) return '_none_\n';
  const keys = Object.keys(rows[0]);
  const lines = [keys.join(' | '), keys.map(() => '---').join(' | ')];
  for (const row of rows) lines.push(keys.map((k) => csvCell(row[k])).join(' | '));
  return lines.join('\n') + '\n';
}

async function q(sql) {
  return prisma.$queryRawUnsafe(sql);
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dbUrl = process.env.DATABASE_URL || '';
  let dbHost = 'unknown';
  try { dbHost = new URL(dbUrl).host; } catch {}

  const report = { stamp, dbHost, scope: 'read-only live DB audit; no writes', sections: {} };

  report.sections.db = {
    fingerprint: await q(`select current_database() as database, current_user as user, inet_server_addr()::text as server_addr, inet_server_port() as server_port, now() as audited_at, version() as version`),
    tableCounts: await q(`
      select table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint as rows
      from information_schema.tables
      where table_schema='public' and table_type='BASE TABLE'
      order by rows desc, table_name
    `),
    columns: await q(`
      select table_name, column_name, data_type, is_nullable
      from information_schema.columns
      where table_schema='public' and table_name in ('CatalogItem','CatalogSet','CatalogSealedProduct','VendorInventoryItem','PackPrize','PackTemplateSlot','CanonicalCatalogGame','CanonicalCatalogSet','CanonicalCatalogCard','CanonicalSealedProduct','CanonicalSearchDoc')
      order by table_name, ordinal_position
    `),
  };

  report.sections.catalogItems = {
    totals: await q(`
      select count(*)::bigint total,
        sum(case when "isActive" then 1 else 0 end)::bigint active,
        sum(case when not "isActive" then 1 else 0 end)::bigint inactive,
        sum(case when coalesce("imageThumbUrl", "imageLargeUrl", "imageBaseUrl") is null then 1 else 0 end)::bigint missing_any_image,
        sum(case when nullif(trim("searchText"),'') is null then 1 else 0 end)::bigint missing_search_text,
        sum(case when "sourcePayload" is null then 1 else 0 end)::bigint missing_source_payload,
        sum(case when "catalogSetId" is null then 1 else 0 end)::bigint missing_catalog_set_link
      from "CatalogItem"
    `),
    bySourceGame: await q(`
      select source, game, language, "itemType", "isActive", count(*)::bigint total,
        sum(case when coalesce("imageThumbUrl", "imageLargeUrl", "imageBaseUrl") is null then 1 else 0 end)::bigint missing_image,
        sum(case when nullif(trim(coalesce("rarity",'')),'') is null then 1 else 0 end)::bigint missing_rarity,
        sum(case when nullif(trim(coalesce("cardNumber",'')),'') is null then 1 else 0 end)::bigint missing_card_number,
        sum(case when "sourcePayload" is null then 1 else 0 end)::bigint missing_source_payload,
        sum(case when "catalogSetId" is null then 1 else 0 end)::bigint missing_catalog_set_link,
        min("createdAt") as first_created,
        max("updatedAt") as last_updated
      from "CatalogItem"
      group by source, game, language, "itemType", "isActive"
      order by source, game, language, "itemType", "isActive" desc
    `),
    duplicates: await q(`
      select source, "sourceItemId", language, count(*)::bigint dup_count, array_agg(id order by id) ids
      from "CatalogItem"
      group by source, "sourceItemId", language
      having count(*) > 1
      order by dup_count desc, source, "sourceItemId"
      limit 50
    `),
    orphanSetLinks: await q(`
      select count(*)::bigint total
      from "CatalogItem" ci
      left join "CatalogSet" cs on cs.id = ci."catalogSetId"
      where ci."catalogSetId" is not null and cs.id is null
    `),
    tcgcsvQuality: await q(`
      select source, game, language, count(*)::bigint total,
        sum(case when coalesce("imageThumbUrl", "imageLargeUrl", "imageBaseUrl") is null then 1 else 0 end)::bigint missing_image,
        sum(case when "catalogSetId" is null then 1 else 0 end)::bigint missing_catalog_set_link,
        sum(case when nullif(trim(coalesce("rarity",'')),'') is null then 1 else 0 end)::bigint missing_rarity,
        sum(case when nullif(trim(coalesce("cardNumber",'')),'') is null then 1 else 0 end)::bigint missing_card_number,
        sum(case when nullif(trim(coalesce("cardType",'')),'') is null then 1 else 0 end)::bigint missing_card_type,
        sum(case when game='ONE_PIECE' and nullif(trim(coalesce(color,'')),'') is null then 1 else 0 end)::bigint one_piece_missing_color,
        sum(case when game='ONE_PIECE' and nullif(trim(coalesce(attribute,'')),'') is null then 1 else 0 end)::bigint one_piece_missing_attribute
      from "CatalogItem"
      where source like 'tcgcsv-cat-%'
      group by source, game, language
      order by source, game, language
    `),
    suspiciousRows: await q(`
      select source, game, language, "sourceItemId", name, "setName", "cardNumber", rarity, "cardType", color, attribute,
        coalesce("imageThumbUrl", "imageLargeUrl", "imageBaseUrl") as image
      from "CatalogItem"
      where "isActive" and (
        coalesce("imageThumbUrl", "imageLargeUrl", "imageBaseUrl") is null
        or nullif(trim("searchText"),'') is null
        or (source like 'tcgcsv-cat-%' and game='ONE_PIECE' and nullif(trim(coalesce("cardType",'')),'') is null)
      )
      order by source, game, name
      limit 80
    `),
  };

  report.sections.catalogSets = {
    bySourceGame: await q(`
      select source, game, language, count(*)::bigint total,
        sum(case when "isActive" then 1 else 0 end)::bigint active,
        sum(case when coalesce("symbolImageUrl", "logoImageUrl", "bannerImageUrl") is null then 1 else 0 end)::bigint missing_any_image,
        sum(case when "sourceCategoryId" is null then 1 else 0 end)::bigint missing_source_category_id,
        sum(case when "productCount" is null then 1 else 0 end)::bigint missing_product_count,
        sum(case when "groupKind" is null then 1 else 0 end)::bigint missing_group_kind,
        sum(case when "reviewStatus" is null then 1 else 0 end)::bigint missing_review_status,
        sum(case when "sourcePayload" is null then 1 else 0 end)::bigint missing_source_payload
      from "CatalogSet"
      group by source, game, language
      order by source, game, language
    `),
    duplicates: await q(`
      select source, "sourceSetId", game, count(*)::bigint dup_count
      from "CatalogSet"
      group by source, "sourceSetId", game
      having count(*) > 1
      order by dup_count desc
      limit 50
    `),
    emptySets: await q(`
      select cs.source, cs.game, count(*)::bigint empty_sets
      from "CatalogSet" cs
      left join "CatalogItem" ci on ci."catalogSetId"=cs.id and ci."isActive"
      left join "CatalogSealedProduct" sp on sp."catalogSetId"=cs.id and sp."isActive"
      group by cs.source, cs.game
      having count(ci.id)=0 and count(sp.id)=0
      order by empty_sets desc
    `),
    samplesMissingImages: await q(`
      select source, game, language, "sourceSetId", name, "groupKind", "reviewStatus", "productCount"
      from "CatalogSet"
      where coalesce("symbolImageUrl", "logoImageUrl", "bannerImageUrl") is null
      order by source, game, name
      limit 80
    `),
  };

  report.sections.sealedProducts = {
    bySourceGame: await q(`
      select source, game, language, count(*)::bigint total,
        sum(case when "isActive" then 1 else 0 end)::bigint active,
        sum(case when "imageUrl" is null then 1 else 0 end)::bigint missing_image,
        sum(case when "catalogSetId" is null then 1 else 0 end)::bigint missing_catalog_set_link,
        sum(case when "productKind" is null then 1 else 0 end)::bigint missing_product_kind,
        sum(case when "cleanName" is null then 1 else 0 end)::bigint missing_clean_name,
        sum(case when "sourcePayload" is null then 1 else 0 end)::bigint missing_source_payload
      from "CatalogSealedProduct"
      group by source, game, language
      order by source, game, language
    `),
    duplicates: await q(`
      select source, "sourceProductId", language, game, count(*)::bigint dup_count
      from "CatalogSealedProduct"
      group by source, "sourceProductId", language, game
      having count(*) > 1
      order by dup_count desc
      limit 50
    `),
    orphanSetLinks: await q(`
      select count(*)::bigint total
      from "CatalogSealedProduct" sp
      left join "CatalogSet" cs on cs.id = sp."catalogSetId"
      where sp."catalogSetId" is not null and cs.id is null
    `),
  };

  report.sections.vendorInventory = {
    totals: await q(`
      select count(*)::bigint total,
        sum("quantityTotal")::bigint quantity_total,
        sum("quantityHeld")::bigint quantity_held,
        sum("quantitySold")::bigint quantity_sold,
        sum(case when "catalogItemId" is null and "customItemId" is null then 1 else 0 end)::bigint missing_catalog_or_custom_ref,
        sum(case when "imageUrl" is null then 1 else 0 end)::bigint missing_image,
        sum(case when "gradeCompany" is not null or grade is not null or "certNumber" is not null then 1 else 0 end)::bigint slab_like,
        sum(case when ("gradeCompany" is not null or grade is not null) and "certNumber" is null then 1 else 0 end)::bigint slab_like_missing_cert,
        sum(case when "quantityHeld" + "quantitySold" > "quantityTotal" then 1 else 0 end)::bigint invalid_quantity_rows,
        sum(case when "quantityTotal" < 0 or "quantityHeld" < 0 or "quantitySold" < 0 then 1 else 0 end)::bigint negative_quantity_rows
      from "VendorInventoryItem"
    `),
    byStatus: await q(`select status, count(*)::bigint total from "VendorInventoryItem" group by status order by status`),
    orphanCatalogLinks: await q(`
      select count(*)::bigint total
      from "VendorInventoryItem" vi
      left join "CatalogItem" ci on ci.id=vi."catalogItemId"
      where vi."catalogItemId" is not null and ci.id is null
    `),
  };

  report.sections.packPrizes = {
    totals: await q(`
      select count(*)::bigint total,
        sum(case when "catalogItemId" is not null or "catalogSourceItemId" is not null then 1 else 0 end)::bigint catalog_linked,
        sum(case when "catalogItemId" is null and "catalogSourceItemId" is null then 1 else 0 end)::bigint unlinked_manual,
        sum(case when ("catalogItemId" is not null or "catalogSourceItemId" is not null) and "catalogSnapshot" is null then 1 else 0 end)::bigint linked_missing_snapshot,
        sum(case when "imageUrl" is null and "imageLargeUrl" is null then 1 else 0 end)::bigint missing_image,
        sum(case when "setId" is null then 1 else 0 end)::bigint missing_set_id,
        sum(case when "cardNumber" is null then 1 else 0 end)::bigint missing_card_number,
        sum(case when rarity is null then 1 else 0 end)::bigint missing_rarity,
        sum(case when "remainingStock" < 0 or stock < 0 or "remainingStock" > stock then 1 else 0 end)::bigint invalid_stock_rows
      from "PackPrize"
    `),
    byPackStatus: await q(`
      select p.status, count(pp.id)::bigint prize_rows,
        sum(case when pp."catalogItemId" is not null or pp."catalogSourceItemId" is not null then 1 else 0 end)::bigint catalog_linked,
        sum(case when pp."imageUrl" is null and pp."imageLargeUrl" is null then 1 else 0 end)::bigint missing_image
      from "PackPrize" pp join "Pack" p on p.id=pp."packId"
      group by p.status order by p.status
    `),
    orphanCatalogLinks: await q(`
      select count(*)::bigint total
      from "PackPrize" pp
      left join "CatalogItem" ci on ci.id=pp."catalogItemId"
      where pp."catalogItemId" is not null and ci.id is null
    `),
    unresolvedSourceRefs: await q(`
      select count(*)::bigint total
      from "PackPrize" pp
      left join "CatalogItem" ci on ci.source=pp."catalogSource" and ci."sourceItemId"=pp."catalogSourceItemId"
      where pp."catalogSourceItemId" is not null and ci.id is null
    `),
    samples: await q(`
      select pp.id, p.status, pp.label, pp."catalogItemId", pp."catalogSource", pp."catalogSourceItemId", pp."catalogSnapshot" is not null as has_snapshot, pp."imageUrl", pp."remainingStock", pp.stock
      from "PackPrize" pp join "Pack" p on p.id=pp."packId"
      order by pp."createdAt" desc
      limit 30
    `),
  };

  report.sections.packTemplates = {
    totals: await q(`
      select count(*)::bigint total,
        sum(case when "catalogItemId" is not null or "catalogSourceItemId" is not null then 1 else 0 end)::bigint catalog_linked,
        sum(case when "catalogItemId" is null and "catalogSourceItemId" is null then 1 else 0 end)::bigint unlinked_manual,
        sum(case when ("catalogItemId" is not null or "catalogSourceItemId" is not null) and "catalogSnapshot" is null then 1 else 0 end)::bigint linked_missing_snapshot,
        sum(case when "imageUrl" is null and "imageLargeUrl" is null then 1 else 0 end)::bigint missing_image
      from "PackTemplateSlot"
    `),
    versionsByStatus: await q(`select status, count(*)::bigint total from "PackTemplateVersion" group by status order by status`),
  };

  report.sections.searchInfra = {
    extensions: await q(`select extname, extversion from pg_extension order by extname`),
    indexes: await q(`
      select tablename, indexname, indexdef
      from pg_indexes
      where schemaname='public' and tablename in ('CatalogItem','CatalogSet','CatalogSealedProduct','CanonicalSearchDoc','CanonicalCatalogCard','CanonicalCatalogSet','VendorInventoryItem','PackPrize')
      order by tablename, indexname
    `),
    relationSizes: await q(`
      select relname, pg_size_pretty(pg_total_relation_size(('public."' || relname || '"')::regclass)) as total_size,
        pg_total_relation_size(('public."' || relname || '"')::regclass)::bigint as bytes
      from pg_stat_user_tables
      where relname in ('CatalogItem','CatalogSet','CatalogSealedProduct','CanonicalSearchDoc','VendorInventoryItem','PackPrize')
      order by bytes desc
    `),
  };

  report.sections.canonical = {
    games: await q(`select code, name, "isActive", "sortOrder" from "CanonicalCatalogGame" order by "sortOrder", code`),
    counts: await q(`
      select 'CanonicalCatalogSet' as table_name, count(*)::bigint total from "CanonicalCatalogSet"
      union all select 'CanonicalCatalogCard', count(*)::bigint from "CanonicalCatalogCard"
      union all select 'CanonicalSealedProduct', count(*)::bigint from "CanonicalSealedProduct"
      union all select 'CanonicalSearchDoc', count(*)::bigint from "CanonicalSearchDoc"
      order by table_name
    `),
    searchDocTypes: await q(`select "entityType", count(*)::bigint total from "CanonicalSearchDoc" group by "entityType" order by total desc`),
  };

  const issues = [];
  const classifyIssueCategory = (area, finding) => {
    const text = `${area} ${finding}`.toLowerCase();
    if (text.includes('missing all images') || text.includes('missing all set images') || text.includes('missing image')) return 'source_image_gap';
    if (text.includes('sourcecategoryid') || text.includes('productcount') || text.includes('groupkind') || text.includes('reviewstatus') || text.includes('sourcepayload') || text.includes('source payload')) return 'source_metadata_gap';
    if (text.includes('vendorinventoryitem') || text.includes('inventory rows')) return 'product_lane_absent';
    if (text.includes('demo')) return 'demo_fixture_gap';
    return 'remediable_db_gap';
  };
  const addIssue = (severity, area, finding, evidence, fix, category = classifyIssueCategory(area, finding)) => issues.push({ severity, area, finding, evidence, fix, category });
  const first = (rows) => rows && rows[0] ? rows[0] : {};

  const ci = first(report.sections.catalogItems.totals);
  if (Number(ci.missing_any_image || 0) > 0) addIssue('P0', 'CatalogItem', `${ci.missing_any_image} active/catalog rows missing all images`, 'CatalogItem totals missing_any_image', 'Backfill images from source payload/upstream or exclude from vendor search until fixed.');
  if (Number(ci.missing_catalog_set_link || 0) > 0) addIssue('P1', 'CatalogItem', `${ci.missing_catalog_set_link} CatalogItem rows have no catalogSetId`, 'CatalogItem totals missing_catalog_set_link', 'Backfill set links for source rows where sourcePayload/groupId/set identity exists; decide allowed unlinked rows.');
  if (Number(ci.missing_source_payload || 0) > 0) addIssue('P1', 'CatalogItem', `${ci.missing_source_payload} CatalogItem rows lack sourcePayload`, 'CatalogItem totals missing_source_payload', 'Re-run imports with payload retention or mark legacy rows as low-trust.');
  for (const row of report.sections.catalogItems.tcgcsvQuality) {
    if (Number(row.missing_image || 0) > 0) addIssue('P0', 'CatalogItem/TCGCSV', `${row.source}/${row.game} has ${row.missing_image} rows missing images`, row, 'Retry source image fetch or remove from vendor-ready selection.');
    if (row.game === 'ONE_PIECE' && Number(row.missing_card_type || 0) > 0) addIssue('P1', 'CatalogItem/One Piece', `${row.source} has ${row.missing_card_type} One Piece rows missing cardType`, row, 'Inspect extendedData labels; patch normalizer/source classification for exact products.');
    if (row.game === 'ONE_PIECE' && (Number(row.one_piece_missing_color || 0) > 0 || Number(row.one_piece_missing_attribute || 0) > 0)) addIssue('P2', 'CatalogItem/One Piece', `${row.source} has One Piece rows missing color/attribute`, row, 'Classify whether these are legitimate products/tokens; backfill where source labels exist.');
  }
  const dups = report.sections.catalogItems.duplicates.length;
  if (dups > 0) addIssue('P0', 'CatalogItem', `${dups} duplicate source identity groups found (limited to first 50)`, report.sections.catalogItems.duplicates.slice(0, 5), 'Resolve unique identity drift before relying on source refs.');

  for (const row of report.sections.catalogSets.bySourceGame) {
    if (Number(row.missing_any_image || 0) > 0) addIssue('P2', 'CatalogSet', `${row.source}/${row.game} has ${row.missing_any_image}/${row.total} sets missing all set images`, row, 'Backfill set logos/symbols/banners from overlapping source only when provenance is recorded; otherwise leave as source_image_gap.');
    if (Number(row.missing_source_category_id || 0) > 0) addIssue('P2', 'CatalogSet source metadata', `${row.source}/${row.game} has ${row.missing_source_category_id}/${row.total} sets missing sourceCategoryId`, row, 'Backfill only when deterministic same-source category mapping exists; otherwise keep as source_metadata_gap.');
    if (Number(row.missing_product_count || 0) > 0) addIssue('P2', 'CatalogSet source metadata', `${row.source}/${row.game} has ${row.missing_product_count}/${row.total} sets missing productCount`, row, 'Backfill only from source-provided product_count metadata; do not fabricate from partial local row counts.');
    if (Number(row.missing_group_kind || 0) > 0) addIssue('P1', 'CatalogSet taxonomy', `${row.source}/${row.game} has ${row.missing_group_kind}/${row.total} sets missing groupKind`, row, 'Apply taxonomy classifier/reviewStatus from scout labels before exposing collection filters.');
    if (Number(row.missing_review_status || 0) > 0) addIssue('P2', 'CatalogSet taxonomy', `${row.source}/${row.game} has ${row.missing_review_status}/${row.total} sets missing reviewStatus`, row, 'Mark auto-classified vs human-review-required.');
  }
  for (const row of report.sections.sealedProducts.bySourceGame) {
    if (Number(row.missing_image || 0) > 0) addIssue('P0', 'CatalogSealedProduct', `${row.source}/${row.game} has ${row.missing_image} sealed products missing image`, row, 'Backfill or hide from vendor-ready sealed selection.');
    if (Number(row.missing_catalog_set_link || 0) > 0) addIssue('P1', 'CatalogSealedProduct', `${row.source}/${row.game} has ${row.missing_catalog_set_link} sealed products missing set link`, row, 'Backfill set links using group/source payload identity.');
  }

  const vi = first(report.sections.vendorInventory.totals);
  if (Number(vi.total || 0) === 0) addIssue('P1', 'VendorInventoryItem', 'No owned/vendor inventory rows exist', vi, 'Build/import owned stock lane; catalog rows are not inventory.');
  else {
    if (Number(vi.missing_catalog_or_custom_ref || 0) > 0) addIssue('P1', 'VendorInventoryItem', `${vi.missing_catalog_or_custom_ref} inventory rows lack catalog/custom refs`, vi, 'Backfill refs or require explicit custom item records.');
    if (Number(vi.invalid_quantity_rows || 0) > 0) addIssue('P0', 'VendorInventoryItem', `${vi.invalid_quantity_rows} inventory rows have invalid quantity math`, vi, 'Repair allocation/quantity ledger.');
  }

  const pp = first(report.sections.packPrizes.totals);
  if (Number(pp.total || 0) > 0 && Number(pp.catalog_linked || 0) === 0) addIssue('P1', 'PackPrize', 'Existing PackPrize rows are all unlinked manual/demo rows', pp, 'Backfill deterministic refs where possible or recreate through source-backed import flow.');
  if (Number(pp.linked_missing_snapshot || 0) > 0) addIssue('P0', 'PackPrize', `${pp.linked_missing_snapshot} linked prizes missing immutable snapshots`, pp, 'Freeze snapshots before publish/draw.');
  if (Number(pp.invalid_stock_rows || 0) > 0) addIssue('P0', 'PackPrize', `${pp.invalid_stock_rows} prize rows have invalid stock math`, pp, 'Repair stock ledger before enabling draws.');

  const pts = first(report.sections.packTemplates.totals);
  if (Number(pts.total || 0) > 0 && Number(pts.catalog_linked || 0) === 0) addIssue('P2', 'PackTemplateSlot', 'Pack template slots exist but none are catalog-linked', pts, 'Use source-backed template slot resolver for production templates.');

  const canonicalCounts = Object.fromEntries(report.sections.canonical.counts.map((r) => [r.table_name, Number(r.total)]));
  if ((canonicalCounts.CanonicalSearchDoc || 0) === 0) addIssue('P1', 'CanonicalSearchDoc', 'Canonical search doc table is empty', report.sections.canonical.counts, 'Either wire universal search to projection tables or populate canonical docs; do not assume canonical layer is live.');

  const extNames = new Set(report.sections.searchInfra.extensions.map((e) => e.extname));
  if (!extNames.has('pg_trgm')) addIssue('P1', 'SearchInfra', 'pg_trgm extension is missing', report.sections.searchInfra.extensions, 'Enable pg_trgm before trigram expression indexes.');
  const indexText = report.sections.searchInfra.indexes.map((i) => i.indexdef).join('\n').toLowerCase();
  if (!indexText.includes('gin') || !indexText.includes('gin_trgm_ops')) addIssue('P1', 'SearchInfra', 'No GIN trigram indexes found on audited search tables', report.sections.searchInfra.indexes.filter((i) => /CatalogItem/.test(i.tablename)), 'Add lower(name/searchText) gin_trgm_ops indexes and verify EXPLAIN.');

  report.issues = issues;

  const outDir = path.join(process.cwd(), 'docs/plans');
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, `live-db-missing-audit-${stamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, jsonReplacer, 2));

  const issueLines = issues.map((i, idx) => `${idx + 1}. **${i.severity} / ${i.area}** — ${i.finding}\n   - Fix: ${i.fix}`).join('\n');
  const md = `# Live DB missing-data audit — ${stamp}\n\nScope: ${report.scope}. Target DB host: \`${dbHost}\`. No DB writes performed.\n\n## Issues\n\n${issueLines || '_No issues detected by current audit checks._'}\n\n## CatalogItem totals\n\n${asTable(report.sections.catalogItems.totals)}\n\n## CatalogItem by source/game/language/type\n\n${asTable(report.sections.catalogItems.bySourceGame)}\n\n## TCGCSV quality\n\n${asTable(report.sections.catalogItems.tcgcsvQuality)}\n\n## CatalogSet by source/game\n\n${asTable(report.sections.catalogSets.bySourceGame)}\n\n## CatalogSealedProduct by source/game\n\n${asTable(report.sections.sealedProducts.bySourceGame)}\n\n## VendorInventoryItem\n\n${asTable(report.sections.vendorInventory.totals)}\n\n## PackPrize\n\n${asTable(report.sections.packPrizes.totals)}\n\n## PackTemplateSlot\n\n${asTable(report.sections.packTemplates.totals)}\n\n## Canonical catalog/search counts\n\n${asTable(report.sections.canonical.counts)}\n\n## Search relation sizes\n\n${asTable(report.sections.searchInfra.relationSizes)}\n\nFull JSON evidence: \`${path.relative(process.cwd(), jsonPath)}\`\n`;
  const mdPath = path.join(outDir, `live-db-missing-audit-${stamp}.md`);
  fs.writeFileSync(mdPath, md);

  console.log(JSON.stringify({ stamp, dbHost, mdPath, jsonPath, issueCount: issues.length, topIssues: issues.slice(0, 20) }, jsonReplacer, 2));
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
