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
function pct(n, d) {
  n = Number(n || 0); d = Number(d || 0);
  return d ? `${((100 * n) / d).toFixed(1)}%` : 'n/a';
}
function stringifyBigInts(row) {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === 'bigint' ? v.toString() : v]));
}

const PAIRS = [
  { label: 'pokemon', game: 'POKEMON', left: 'tcgtracking', right: 'pokemoncard.io', lang: null },
  { label: 'pokemon_en_only', game: 'POKEMON', left: 'tcgtracking', right: 'pokemoncard.io', lang: 'en' },
  { label: 'one_piece', game: 'ONE_PIECE', left: 'tcgtracking', right: 'onepiecedb.io', lang: null },
];

async function comparePair(pair) {
  const langClause = pair.lang ? `and language = '${pair.lang.replace(/'/g, "''")}'` : '';
  const rows = await prisma.$queryRawUnsafe(`
    with base as (
      select id, source, game, language, "sourceItemId", name, "setId", "setName", "localId", "cardNumber", rarity,
             nullif(nullif(coalesce(
               "sourcePayload"->'raw'->>'tcgplayer_id',
               "sourcePayload"->'raw'->>'tcgplayer_product_id',
               case when source = 'tcgtracking' then "sourcePayload"->'raw'->>'id' else null end
             ), ''), '0') as tcgplayer_id,
             lower(regexp_replace(coalesce(name,''), '[^a-zA-Z0-9]+', '', 'g')) as norm_name,
             lower(regexp_replace(coalesce("cardNumber", "localId", ''), '[^a-zA-Z0-9]+', '', 'g')) as norm_number,
             lower(regexp_replace(coalesce("setName", ''), '[^a-zA-Z0-9]+', '', 'g')) as norm_set_name
      from "CatalogItem"
      where game = '${pair.game}' and source in ('${pair.left}', '${pair.right}') ${langClause}
    ),
    left_rows as (select * from base where source = '${pair.left}'),
    right_rows as (select * from base where source = '${pair.right}'),
    left_ids as (select distinct tcgplayer_id from left_rows where tcgplayer_id is not null),
    right_ids as (select distinct tcgplayer_id from right_rows where tcgplayer_id is not null),
    left_keys as (select distinct norm_name, norm_number from left_rows where norm_name <> '' and norm_number <> ''),
    right_keys as (select distinct norm_name, norm_number from right_rows where norm_name <> '' and norm_number <> ''),
    left_set_keys as (select distinct norm_name, norm_number, norm_set_name from left_rows where norm_name <> '' and norm_number <> '' and norm_set_name <> ''),
    right_set_keys as (select distinct norm_name, norm_number, norm_set_name from right_rows where norm_name <> '' and norm_number <> '' and norm_set_name <> '')
    select
      '${pair.label}' as label,
      '${pair.game}' as game,
      '${pair.left}' as left_source,
      '${pair.right}' as right_source,
      ${pair.lang ? `'${pair.lang}'` : `'all'`} as language_scope,
      (select count(*) from left_rows)::bigint as left_rows,
      (select count(*) from right_rows)::bigint as right_rows,
      (select count(*) from left_rows where tcgplayer_id is not null)::bigint as left_rows_with_tcgplayer_id,
      (select count(*) from right_rows where tcgplayer_id is not null)::bigint as right_rows_with_tcgplayer_id,
      (select count(*) from left_ids)::bigint as left_distinct_tcgplayer_ids,
      (select count(*) from right_ids)::bigint as right_distinct_tcgplayer_ids,
      (select count(*) from left_ids l join right_ids r using (tcgplayer_id))::bigint as overlap_tcgplayer_ids,
      (select count(*) from left_rows l where l.tcgplayer_id is not null and exists (select 1 from right_ids r where r.tcgplayer_id = l.tcgplayer_id))::bigint as left_rows_matched_by_tcgplayer_id,
      (select count(*) from right_rows r where r.tcgplayer_id is not null and exists (select 1 from left_ids l where l.tcgplayer_id = r.tcgplayer_id))::bigint as right_rows_matched_by_tcgplayer_id,
      (select count(*) from left_rows l where l.tcgplayer_id is not null and not exists (select 1 from right_ids r where r.tcgplayer_id = l.tcgplayer_id))::bigint as left_rows_only_by_tcgplayer_id,
      (select count(*) from right_rows r where r.tcgplayer_id is not null and not exists (select 1 from left_ids l where l.tcgplayer_id = r.tcgplayer_id))::bigint as right_rows_only_by_tcgplayer_id,
      (select count(*) from left_rows where tcgplayer_id is null)::bigint as left_rows_without_tcgplayer_id,
      (select count(*) from right_rows where tcgplayer_id is null)::bigint as right_rows_without_tcgplayer_id,
      (select count(*) from left_keys)::bigint as left_distinct_name_number_keys,
      (select count(*) from right_keys)::bigint as right_distinct_name_number_keys,
      (select count(*) from left_keys l join right_keys r using (norm_name, norm_number))::bigint as overlap_name_number_keys,
      (select count(*) from left_set_keys)::bigint as left_distinct_name_number_set_keys,
      (select count(*) from right_set_keys)::bigint as right_distinct_name_number_set_keys,
      (select count(*) from left_set_keys l join right_set_keys r using (norm_name, norm_number, norm_set_name))::bigint as overlap_name_number_set_keys
  `);
  const summary = stringifyBigInts(rows[0]);

  async function sample(side, onlyMode) {
    const source = side === 'left' ? pair.left : pair.right;
    const other = side === 'left' ? pair.right : pair.left;
    return (await prisma.$queryRawUnsafe(`
      with base as (
        select id, source, game, language, "sourceItemId", name, "setId", "setName", "localId", "cardNumber", rarity,
               nullif(nullif(coalesce(
                 "sourcePayload"->'raw'->>'tcgplayer_id',
                 "sourcePayload"->'raw'->>'tcgplayer_product_id',
                 case when source = 'tcgtracking' then "sourcePayload"->'raw'->>'id' else null end
               ), ''), '0') as tcgplayer_id,
               lower(regexp_replace(coalesce(name,''), '[^a-zA-Z0-9]+', '', 'g')) as norm_name,
               lower(regexp_replace(coalesce("cardNumber", "localId", ''), '[^a-zA-Z0-9]+', '', 'g')) as norm_number
        from "CatalogItem"
        where game = '${pair.game}' and source in ('${pair.left}', '${pair.right}') ${langClause}
      ),
      other_ids as (select distinct tcgplayer_id from base where source = '${other}' and tcgplayer_id is not null),
      other_keys as (select distinct norm_name, norm_number from base where source = '${other}' and norm_name <> '' and norm_number <> '')
      select source, game, language, "sourceItemId", tcgplayer_id, name, "setId", "setName", "localId", "cardNumber", rarity
      from base b
      where b.source = '${source}'
        and ${onlyMode === 'tcgplayer' ? `b.tcgplayer_id is not null and not exists (select 1 from other_ids o where o.tcgplayer_id = b.tcgplayer_id)` : `b.norm_name <> '' and b.norm_number <> '' and not exists (select 1 from other_keys o where o.norm_name = b.norm_name and o.norm_number = b.norm_number)`}
      order by "setName" nulls last, "cardNumber" nulls last, name
      limit 30
    `)).map(stringifyBigInts);
  }

  const samples = {
    leftOnlyByTcgplayer: await sample('left', 'tcgplayer'),
    rightOnlyByTcgplayer: await sample('right', 'tcgplayer'),
    leftOnlyByNameNumber: await sample('left', 'nameNumber'),
    rightOnlyByNameNumber: await sample('right', 'nameNumber'),
  };

  return { summary, samples };
}

(async () => {
  const outDir = path.join(process.cwd(), 'docs/plans');
  const db = safeDbInfo(process.env.DATABASE_URL || '');
  const generated = new Date().toISOString();
  const comparisons = [];
  for (const pair of PAIRS) comparisons.push(await comparePair(pair));

  const summaryRows = comparisons.map(c => c.summary);
  const summaryCols = [
    'label','game','left_source','right_source','language_scope','left_rows','right_rows',
    'left_rows_with_tcgplayer_id','right_rows_with_tcgplayer_id','left_distinct_tcgplayer_ids','right_distinct_tcgplayer_ids','overlap_tcgplayer_ids',
    'left_rows_matched_by_tcgplayer_id','right_rows_matched_by_tcgplayer_id','left_rows_only_by_tcgplayer_id','right_rows_only_by_tcgplayer_id',
    'left_rows_without_tcgplayer_id','right_rows_without_tcgplayer_id','left_distinct_name_number_keys','right_distinct_name_number_keys','overlap_name_number_keys','left_distinct_name_number_set_keys','right_distinct_name_number_set_keys','overlap_name_number_set_keys'
  ];
  fs.writeFileSync(path.join(outDir, 'catalogitem-source-delta-summary.csv'), toCsv(summaryRows, summaryCols));

  const sampleCols = ['comparison','sample_type','source','game','language','sourceItemId','tcgplayer_id','name','setId','setName','localId','cardNumber','rarity'];
  const sampleRows = [];
  for (const c of comparisons) {
    for (const [sample_type, rows] of Object.entries(c.samples)) {
      for (const r of rows) sampleRows.push({ comparison: c.summary.label, sample_type, ...r });
    }
  }
  fs.writeFileSync(path.join(outDir, 'catalogitem-source-delta-samples.csv'), toCsv(sampleRows, sampleCols));

  const compactRows = summaryRows.map(r => ({
    comparison: r.label,
    rows: `${r.left_source} ${r.left_rows} vs ${r.right_source} ${r.right_rows}`,
    tcgplayer_id_overlap: `${r.overlap_tcgplayer_ids} IDs`,
    left_matched: `${r.left_rows_matched_by_tcgplayer_id} (${pct(r.left_rows_matched_by_tcgplayer_id, r.left_rows_with_tcgplayer_id)} of rows with ID)`,
    right_matched: `${r.right_rows_matched_by_tcgplayer_id} (${pct(r.right_rows_matched_by_tcgplayer_id, r.right_rows_with_tcgplayer_id)} of rows with ID)`,
    left_only_by_id: r.left_rows_only_by_tcgplayer_id,
    right_only_by_id: r.right_rows_only_by_tcgplayer_id,
    name_number_key_overlap: `${r.overlap_name_number_keys} keys`,
    name_number_set_key_overlap: `${r.overlap_name_number_set_keys} keys`,
  }));

  let md = `# CatalogItem Source Delta: TCGTracking vs Dedicated DB Sources\n\nGenerated: ${generated}\n\n## Target DB\n\n- host: ${db.host}\n- port: ${db.port}\n- database: ${db.database}\n- user: ${db.user}\n- URL fingerprint: ${db.fingerprint}\n- table: \`CatalogItem\`\n- query mode: read-only delta\n\n## Match rules\n\nPrimary cross-source match uses upstream TCGPlayer product id:\n\n- \`tcgtracking\`: \`sourcePayload.raw.id\`\n- \`pokemoncard.io\`: \`sourcePayload.raw.tcgplayer_id\`\n- \`onepiecedb.io\`: \`sourcePayload.raw.tcgplayer_product_id\`\n\nSecondary weak match is normalized \`(name, cardNumber/localId)\`. It is only a coverage clue because names/variants/set naming differ by source.\n\n## Summary\n\n${mdTable(compactRows, ['comparison','rows','tcgplayer_id_overlap','left_matched','right_matched','left_only_by_id','right_only_by_id','name_number_key_overlap','name_number_set_key_overlap'])}\n\n## Full numeric summary\n\n${mdTable(summaryRows, summaryCols)}\n`;

  function sampleSection(title, rows) {
    const cols = ['source','game','language','sourceItemId','tcgplayer_id','name','setId','setName','localId','cardNumber','rarity'];
    return `\n### ${title}\n\n${rows.length ? mdTable(rows.slice(0, 20), cols) : '_No sample rows._'}\n`;
  }
  for (const c of comparisons) {
    md += `\n## Samples: ${c.summary.label}\n`;
    md += sampleSection(`${c.summary.left_source} only by TCGPlayer id`, c.samples.leftOnlyByTcgplayer);
    md += sampleSection(`${c.summary.right_source} only by TCGPlayer id`, c.samples.rightOnlyByTcgplayer);
    md += sampleSection(`${c.summary.left_source} only by weak name+number`, c.samples.leftOnlyByNameNumber);
    md += sampleSection(`${c.summary.right_source} only by weak name+number`, c.samples.rightOnlyByNameNumber);
  }
  md += `\n## Interpretation guardrail\n\nThis is a delta report, not a delete list. Cross-source catalogs are not authoritative substitutes for each other. Use TCGPlayer-id overlap to identify duplicate external products, and inspect samples before pruning any source/game slice.\n`;

  const mdPath = path.join(outDir, 'catalogitem-source-delta-tcgtracking-vs-dedicated-20260530.md');
  fs.writeFileSync(mdPath, md);
  console.log(mdPath);
  console.log(path.join(outDir, 'catalogitem-source-delta-summary.csv'));
  console.log(path.join(outDir, 'catalogitem-source-delta-samples.csv'));
})().finally(() => prisma.$disconnect());
