# PostCSS / Next.js advisory review

Reviewed: 2026-06-09T04:30:13Z
Card: OBFP-014

## Advisory

`npm audit` reports two moderate findings:

- `postcss` advisory GHSA-qx2v-qp2m-jg93: XSS via unescaped `</style>` in CSS stringify output, vulnerable range `<8.5.10`.
- `next` is reported as affected because the installed `next@16.2.6` package depends on `postcss@8.4.31`.

Current installed path:

```text
@oripa/web -> next@16.2.6 -> postcss@8.4.31
```

The local lockfile resolves `next@16.2.6`; the `next` package declares `postcss: 8.4.31` internally.

## Remediation decision

No dependency downgrade or forced audit fix was applied.

Why:

- `npm audit` advertises a fix of `next@9.3.3`, marked semver-major, which is an unsafe downgrade from `next@16.2.6` and would break the React 19 / Next 16 application line.
- The latest stable `next` dist-tag at review time is `16.2.7`, but `next@16.2.7` still declares `postcss: 8.4.31`, so a stable patch upgrade does not clear this advisory.
- The canary line (`16.3.0-canary.*`) declares `postcss: 8.5.10`, but adopting canary Next is not a safe patch/minor production remediation for this card.

## Status

`npm audit` remains non-zero with two moderate findings until a stable Next release depends on `postcss >= 8.5.10` or the project explicitly accepts a separately tested package-manager override. The current safe action is to keep Next on stable, avoid `npm audit fix --force`, and re-check when a stable Next release with the fixed PostCSS dependency is published.

## Follow-up trigger

Re-run this review when either is true:

1. A stable Next release after `16.2.7` is available and declares `postcss >= 8.5.10`.
2. The team explicitly approves a package-manager override test plan for Next's internal PostCSS dependency.

Verification commands for this review:

```bash
npm audit
npm view next version dist-tags --json
npm view next@16.2.7 dependencies.postcss version --json
npm view next@canary dependencies.postcss version --json
npm run lint
npm run build
npm run test -w @oripa/api
```
