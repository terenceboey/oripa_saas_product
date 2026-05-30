#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from datetime import datetime, timezone
import hashlib
import html
import re

import markdown

ROOT = Path('/home/yeqiuqiu/oripa_saas')
SRC = ROOT / 'docs/plans/catalog-db-architecture-gpt55pro-oracle-proposal-v2.md'
OUT = ROOT / 'docs/plans/catalog-db-architecture-gpt55pro-oracle-proposal-v2.html'

raw = SRC.read_text(encoding='utf-8')
source_sha = hashlib.sha256(raw.encode('utf-8')).hexdigest()
now = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')

# Normalize the markdown title flow: keep the original content, but render under a polished cover.
md = markdown.Markdown(
    extensions=[
        'extra',
        'tables',
        'fenced_code',
        'sane_lists',
        'toc',
        'attr_list',
    ],
    extension_configs={
        'toc': {
            'permalink': False,
            'toc_depth': '1-3',
            'slugify': lambda value, sep: re.sub(r'[^a-z0-9]+', sep, value.lower()).strip(sep),
        }
    },
    output_format='html',
)
body = md.convert(raw)
toc = getattr(md, 'toc', '')

# Make the auto TOC title less noisy.
toc = toc.replace('<div class="toc">', '<nav class="toc" aria-label="Proposal table of contents">', 1).replace('</div>', '</nav>', 1)

html_doc = f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Oripa Catalog Database Architecture Proposal</title>
  <style>
    :root {{
      --bg: #f6f8fb;
      --paper: #ffffff;
      --ink: #172033;
      --muted: #5b6475;
      --line: #dfe5ef;
      --brand: #5847f5;
      --brand-2: #08a88a;
      --brand-3: #ffb020;
      --danger: #d64545;
      --code-bg: #101828;
      --code-ink: #edf2ff;
      --shadow: 0 18px 60px rgba(16, 24, 40, .10);
      --radius: 18px;
      --content: 980px;
    }}
    * {{ box-sizing: border-box; }}
    html {{ scroll-behavior: smooth; }}
    body {{
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(88, 71, 245, .14), transparent 32rem),
        radial-gradient(circle at top right, rgba(8, 168, 138, .12), transparent 30rem),
        var(--bg);
      line-height: 1.62;
    }}
    a {{ color: var(--brand); text-decoration: none; }}
    a:hover {{ text-decoration: underline; }}
    .page {{ max-width: 1320px; margin: 0 auto; padding: 42px 26px 80px; }}
    .cover {{
      background: linear-gradient(135deg, #111827 0%, #261f72 55%, #087c72 100%);
      color: white;
      border-radius: 28px;
      padding: 52px;
      box-shadow: var(--shadow);
      position: relative;
      overflow: hidden;
    }}
    .cover:before {{
      content: "";
      position: absolute;
      inset: -20% -10% auto auto;
      width: 520px;
      height: 520px;
      background: radial-gradient(circle, rgba(255,255,255,.16), transparent 62%);
      pointer-events: none;
    }}
    .eyebrow {{
      display: inline-flex;
      gap: 10px;
      align-items: center;
      padding: 7px 12px;
      border: 1px solid rgba(255,255,255,.25);
      border-radius: 999px;
      background: rgba(255,255,255,.10);
      color: #dbeafe;
      font-size: 13px;
      letter-spacing: .04em;
      text-transform: uppercase;
      font-weight: 700;
    }}
    .cover h1 {{
      margin: 22px 0 14px;
      font-size: clamp(36px, 5vw, 64px);
      line-height: .98;
      letter-spacing: -.055em;
      max-width: 940px;
    }}
    .subtitle {{ max-width: 920px; color: #e5edf8; font-size: 20px; margin: 0; }}
    .meta-grid {{
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      margin-top: 34px;
    }}
    .meta-card {{
      border: 1px solid rgba(255,255,255,.20);
      background: rgba(255,255,255,.10);
      border-radius: 16px;
      padding: 16px;
      backdrop-filter: blur(14px);
      min-height: 94px;
    }}
    .meta-card strong {{ display: block; font-size: 13px; color: #bfd7ff; text-transform: uppercase; letter-spacing: .05em; }}
    .meta-card span {{ display: block; margin-top: 8px; color: #fff; font-size: 17px; font-weight: 750; }}
    .summary {{
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
      margin: 24px 0;
    }}
    .summary-card {{
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 22px;
      box-shadow: 0 10px 30px rgba(16,24,40,.05);
    }}
    .summary-card h3 {{ margin: 0 0 8px; font-size: 16px; letter-spacing: -.01em; }}
    .summary-card p {{ margin: 0; color: var(--muted); }}
    .layout {{
      display: grid;
      grid-template-columns: 295px minmax(0, 1fr);
      gap: 28px;
      align-items: start;
      margin-top: 28px;
    }}
    aside {{ position: sticky; top: 22px; }}
    .toc {{
      max-height: calc(100vh - 44px);
      overflow: auto;
      background: rgba(255,255,255,.86);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      padding: 18px 18px 20px;
      box-shadow: 0 10px 32px rgba(16,24,40,.06);
      backdrop-filter: blur(14px);
      font-size: 14px;
    }}
    .toc:before {{ content: "Contents"; display: block; font-weight: 800; font-size: 13px; text-transform: uppercase; color: var(--muted); letter-spacing: .08em; margin-bottom: 10px; }}
    .toc ul {{ list-style: none; padding-left: 0; margin: 0; }}
    .toc li {{ margin: 7px 0; }}
    .toc ul ul {{ padding-left: 14px; border-left: 1px solid var(--line); margin: 8px 0 8px 2px; }}
    .toc a {{ color: #2d3748; }}
    main.article {{
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 24px;
      padding: 44px 54px;
      box-shadow: var(--shadow);
      max-width: var(--content);
    }}
    .callout {{
      border-left: 5px solid var(--brand);
      background: #f3f4ff;
      padding: 18px 20px;
      border-radius: 14px;
      margin: 0 0 30px;
      color: #293056;
    }}
    .callout strong {{ color: #1f2373; }}
    h1, h2, h3, h4 {{ color: #111827; letter-spacing: -.035em; line-height: 1.16; }}
    main.article > h1 {{
      margin-top: 58px;
      padding-top: 34px;
      border-top: 1px solid var(--line);
      font-size: 34px;
    }}
    main.article > h1:first-of-type {{ margin-top: 0; padding-top: 0; border-top: 0; }}
    h2 {{ margin-top: 34px; font-size: 25px; }}
    h3 {{ margin-top: 28px; font-size: 20px; }}
    p, li {{ font-size: 16px; }}
    p {{ margin: 13px 0; }}
    ul, ol {{ padding-left: 1.35rem; }}
    li + li {{ margin-top: 5px; }}
    code {{
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      background: #eef2ff;
      color: #34318a;
      padding: .15em .35em;
      border-radius: 7px;
      font-size: .92em;
    }}
    pre {{
      background: var(--code-bg);
      color: var(--code-ink);
      padding: 20px;
      border-radius: 16px;
      overflow: auto;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.08);
    }}
    pre code {{ background: transparent; color: inherit; padding: 0; border-radius: 0; }}
    table {{
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin: 22px 0;
      border: 1px solid var(--line);
      border-radius: 15px;
      overflow: hidden;
      font-size: 14px;
    }}
    th {{ background: #f1f5fb; text-align: left; font-weight: 800; color: #253047; }}
    th, td {{ padding: 12px 14px; vertical-align: top; border-bottom: 1px solid var(--line); }}
    tr:last-child td {{ border-bottom: 0; }}
    blockquote {{
      margin: 22px 0;
      padding: 16px 20px;
      border-left: 5px solid var(--brand-2);
      background: #effcf8;
      border-radius: 14px;
      color: #24443e;
    }}
    .footer {{
      max-width: var(--content);
      margin: 24px 0 0 auto;
      color: var(--muted);
      font-size: 13px;
      text-align: right;
    }}
    .print-button {{
      position: fixed;
      right: 24px;
      bottom: 24px;
      border: 0;
      background: var(--brand);
      color: white;
      border-radius: 999px;
      padding: 13px 17px;
      font-weight: 800;
      box-shadow: 0 10px 30px rgba(88, 71, 245, .35);
      cursor: pointer;
    }}
    @media (max-width: 980px) {{
      .page {{ padding: 20px 14px 60px; }}
      .cover {{ padding: 34px 26px; }}
      .meta-grid, .summary {{ grid-template-columns: 1fr; }}
      .layout {{ grid-template-columns: 1fr; }}
      aside {{ position: static; }}
      main.article {{ padding: 30px 22px; }}
      .print-button {{ display: none; }}
    }}
    @media print {{
      body {{ background: white; }}
      .page {{ max-width: none; padding: 0; }}
      .cover, main.article, .summary-card, .toc {{ box-shadow: none; }}
      .layout {{ display: block; }}
      aside, .print-button {{ display: none; }}
      .cover {{ border-radius: 0; color: white; print-color-adjust: exact; -webkit-print-color-adjust: exact; }}
      main.article {{ border: 0; padding: 28px 0; max-width: none; }}
      main.article > h1 {{ break-before: page; }}
      pre, table {{ break-inside: avoid; }}
      a {{ color: inherit; text-decoration: none; }}
    }}
  </style>
</head>
<body>
  <button class="print-button" onclick="window.print()">Print / Save PDF</button>
  <div class="page">
    <section class="cover">
      <div class="eyebrow">Oripa · Database Architecture Proposal</div>
      <h1>Catalog, Inventory & Prize Snapshot Architecture</h1>
      <p class="subtitle">A leadership-ready proposal derived from GPT-5.5 Pro Oracle review, repo evidence, live database evidence, and locked product decisions.</p>
      <div class="meta-grid">
        <div class="meta-card"><strong>Prepared for</strong><span>Oripa leadership review</span></div>
        <div class="meta-card"><strong>Source</strong><span>GPT-5.5 Pro Oracle v2</span></div>
        <div class="meta-card"><strong>Generated</strong><span>{html.escape(now)}</span></div>
        <div class="meta-card"><strong>Scope</strong><span>Catalog · Search · Inventory · Prizes</span></div>
      </div>
    </section>

    <section class="summary" aria-label="Executive summary cards">
      <div class="summary-card">
        <h3>Recommendation</h3>
        <p>Keep <code>CatalogItem</code> as compatibility bridge, add layered canonical catalog, source provenance, subtype tables, vendor inventory, and immutable prize snapshots.</p>
      </div>
      <div class="summary-card">
        <h3>Why now</h3>
        <p>Current search is multi-second at 220k+ rows, live schema drift exists, and pack prizes do not preserve canonical identity or immutable snapshots.</p>
      </div>
      <div class="summary-card">
        <h3>Migration posture</h3>
        <p>Additive only: reconcile live schema first, add indexes/projections behind flags, backfill, shadow-read, then enforce.</p>
      </div>
    </section>

    <div class="layout">
      <aside>{toc}</aside>
      <main class="article">
        <div class="callout"><strong>Bottom line:</strong> Do not replace the current catalog destructively. Add the missing architecture layers around it, make pack prizes immutable snapshots, and fix search with targeted Postgres indexes/projections before expanding product types.</div>
        {body}
      </main>
    </div>

    <div class="footer">Generated from <code>{html.escape(str(SRC))}</code><br/>Source SHA256: <code>{source_sha}</code></div>
  </div>
</body>
</html>
'''

OUT.write_text(html_doc, encoding='utf-8')
print(OUT)
print('bytes', OUT.stat().st_size)
print('sha256', hashlib.sha256(html_doc.encode('utf-8')).hexdigest())
