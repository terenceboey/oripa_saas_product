#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

function safeDbInfo(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port || '(default)',
    database: u.pathname.replace(/^\//, ''),
    user: decodeURIComponent(u.username || ''),
    fingerprint: crypto.createHash('sha256').update(url).digest('hex').slice(0, 12),
  };
}
function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCsv(rows, cols) {
  return [cols.join(','), ...rows.map(r => cols.map(c => csvEscape(r[c])).join(','))].join('\n') + '\n';
}
function mdTable(rows, cols) {
  const header = `| ${cols.join(' | ')} |`;
  const sep = `| ${cols.map(() => '---').join(' | ')} |`;
  const body = rows.map(r => `| ${cols.map(c => String(r[c] ?? '')).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
}
(async () => {
  const outDir = path.join(process.cwd(), 'docs/plans');
  const db = safeDbInfo(process.env.DATABASE_URL || '');
  const total = await prisma.$queryRawUnsafe(`select count(*)::bigint as count from "CatalogItem"`);
  const sourceTotals = await prisma.$queryRawUnsafe(`
    select source, count(*)::bigint as count,
           count(distinct game)::int as games,
           count(distinct language)::int as languages,
           count(distinct "itemType")::int as item_types,
           sum(case when "isActive" then 1 else 0 end)::bigint as active,
           sum(case when not "isActive" then 1 else 0 end)::bigint as inactive
    from "CatalogItem"
    group by source
    order by count desc
  `);
  const sourceGameTotals = await prisma.$queryRawUnsafe(`
    select source, game, count(*)::bigint as count,
           count(distinct language)::int as languages,
           count(distinct "itemType")::int as item_types,
           sum(case when "isActive" then 1 else 0 end)::bigint as active,
           sum(case when not "isActive" then 1 else 0 end)::bigint as inactive
    from "CatalogItem"
    group by source, game
    order by source, count desc, game
  `);
  const detailed = await prisma.$queryRawUnsafe(`
    select source, game, language, "itemType", "isActive", count(*)::bigint as count,
           min("createdAt") as first_created, max("createdAt") as last_created
    from "CatalogItem"
    group by source, game, language, "itemType", "isActive"
    order by source, game, language, "itemType", "isActive" desc
  `);
  const gameTotals = await prisma.$queryRawUnsafe(`
    select game, count(*)::bigint as count,
           count(distinct source)::int as sources,
           count(distinct language)::int as languages,
           count(distinct "itemType")::int as item_types,
           sum(case when "isActive" then 1 else 0 end)::bigint as active,
           sum(case when not "isActive" then 1 else 0 end)::bigint as inactive
    from "CatalogItem"
    group by game
    order by count desc
  `);
  const dupes = await prisma.$queryRawUnsafe(`
    select count(*)::bigint as duplicate_groups from (
      select source, "sourceItemId", language, count(*)
      from "CatalogItem"
      group by source, "sourceItemId", language
      having count(*) > 1
    ) d
  `);
  const sourceCols = ['source', 'count', 'games', 'languages', 'item_types', 'active', 'inactive'];
  const sgCols = ['source', 'game', 'count', 'languages', 'item_types', 'active', 'inactive'];
  const detailCols = ['source', 'game', 'language', 'itemType', 'isActive', 'count', 'first_created', 'last_created'];
  const gameCols = ['game', 'count', 'sources', 'languages', 'item_types', 'active', 'inactive'];
  fs.writeFileSync(path.join(outDir, 'catalogitem-inventory-by-source-game.csv'), toCsv(detailed, detailCols));
  const md = `# CatalogItem Inventory by Source and Game\n\nGenerated: ${new Date().toISOString()}\n\n## Target DB\n\n- host: ${db.host}\n- port: ${db.port}\n- database: ${db.database}\n- user: ${db.user}\n- URL fingerprint: ${db.fingerprint}\n- table: \`CatalogItem\`\n- query mode: read-only inventory\n\n## Summary\n\n- total rows: ${total[0].count}\n- duplicate source identity groups \`(source, sourceItemId, language)\`: ${dupes[0].duplicate_groups}\n- inactive rows: ${sourceTotals.reduce((a, r) => a + BigInt(r.inactive), 0n)}\n\n## By source\n\n${mdTable(sourceTotals, sourceCols)}\n\n## By source and game\n\n${mdTable(sourceGameTotals, sgCols)}\n\n## By game\n\n${mdTable(gameTotals, gameCols)}\n\n## Full source/game/language/itemType detail\n\n${mdTable(detailed.map(r => ({...r, first_created: r.first_created?.toISOString?.() ?? r.first_created, last_created: r.last_created?.toISOString?.() ?? r.last_created})), detailCols)}\n\n## Pruning note\n\nDo not delete anything from this table without an explicit target slice. Use stable filters such as \`source\`, \`game\`, \`language\`, \`itemType\`, and optionally \`sourceItemId\` prefix/category. For destructive pruning, capture before counts, delete transactionally with assertions, then re-run this inventory.\n`;
  const out = path.join(outDir, 'catalogitem-pruning-inventory-20260530.md');
  fs.writeFileSync(out, md);
  console.log(out);
  console.log(path.join(outDir, 'catalogitem-inventory-by-source-game.csv'));
})().finally(() => prisma.$disconnect());
