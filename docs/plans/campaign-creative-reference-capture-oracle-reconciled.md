# Campaign Creative Reference Capture — Oracle-Reconciled Protocol

## Verdict

Keep the Campaign Creative Generator architecture unchanged. Do **not** use Clove/competitor screenshots as GPT Image 2 inputs, production prompt references, compositor backgrounds, repo fixtures, seed data, or direct implementation references.

Competitor references are useful only as **quarantined competitive research** that produces a neutral abstraction report and Oripa-owned `CreativeTemplate` specs.

## Revised plan

### Track A — MVP proceeds without competitor assets

Build the module from generic ecommerce campaign principles and Oripa-owned visual tokens:

- `CampaignCreativeTemplate`
- `CampaignCreativeJob`
- `CampaignCreativeJobItem`
- `CampaignCreativeAsset`
- BullMQ worker
- storage abstraction
- GPT Image 2 background-only adapter
- deterministic compositor for exact `CatalogItem` cards, copy, CTA, and crop
- explicit publish adapter into existing `VendorBanner.imageUrl`

Use neutral template keys only, for example:

- `premium_drop_split_hero`
- `foil_stage_card_trio`
- `dark_gradient_product_showcase`
- `seasonal_pack_spotlight`

### Track B — legal/product-gated competitive research

Only after explicit approval:

1. Capture minimal public page screenshots for layout research only.
2. Prefer page-context screenshots over clean reusable banner downloads.
3. Keep raw references outside source control, seed data, tests, public buckets, prompt snapshots, and template fixtures.
4. Mark all references `internal_analysis_only`.
5. Run abstraction-only analysis.
6. Output neutral `CreativeTemplate` specs, avoid-lists, negative prompts, and similarity-review checks.
7. Require product/legal review before activating any template derived from competitor research.

## Capture pack format if approved

Directory shape:

```text
competitive-reference-pack/
  README.md
  sources.csv
  desktop/
  mobile/
  page-context/
```

`sources.csv` should include:

```text
id,filename,url,capture_date,captured_by,viewport,device,page_type,context,rights_owner_or_brand,competitor_reference,capture_basis,legal_review_status,approved_use,forbidden_use,distinctive_elements_to_avoid,generic_principles_observed,similarity_risk,notes
```

Recommended field values:

```text
competitor_reference: true
approved_use: internal_analysis_only
forbidden_use: prompt_input, model_training, production_asset, template_fixture, direct_layout_copy
legal_review_status: pending | approved_for_research | rejected
similarity_risk: low | medium | high
```

README warning block:

```md
# Usage Restrictions

This pack is for internal competitive research only.

Do not:
- use screenshots or downloaded assets as GPT Image 2 inputs;
- use screenshots as compositor backgrounds;
- copy exact layouts, copy, logos, badges, characters, icons, CTA wording, color combinations, or distinctive trade dress;
- commit these assets into app source, seed data, tests, template fixtures, or public storage;
- reference the competitor by name in production prompts or template keys.

Allowed output:
- generic ecommerce campaign design principles;
- neutral Oripa-owned CreativeTemplate specs;
- avoid-list / negative prompts / similarity review checklist.
```

## Downstream output shape

The analysis output should be implementation-ready but competitor-neutral:

```ts
type CreativeTemplateSpec = {
  key: string;
  name: string;
  surface: 'vendor_banner';
  outputWidth: number;
  outputHeight: number;
  designIntent: string;
  allowedUse: string[];
  forbiddenUse: string[];
  backgroundPromptTokens: {
    mood: string[];
    environment: string[];
    lighting: string[];
    texture: string[];
    paletteTokens: string[];
  };
  negativePromptTokens: string[];
  layoutJson: {
    safeZones: unknown;
    textZones: unknown;
    cardSlots: unknown;
    ctaZone: unknown;
    mobileCropRules?: unknown;
  };
  compositorRules: {
    cardImageSource: 'CatalogItem.imageLargeUrl | imageBaseUrl';
    maxCards: number;
    shadows: unknown;
    glows: unknown;
    strokes: unknown;
    typographyToken: string;
    ctaToken: string;
  };
  copyRules: {
    titleMaxChars: number;
    subtitleMaxChars: number;
    ctaAllowlist: string[];
    blockedClaims: string[];
  };
  similarityReview: {
    mustNotResembleNamedCompetitor: boolean;
    bannedReferenceSpecificElements: string[];
    reviewerChecklist: string[];
  };
};
```

## GPT Image 2 constraints

Hard prompt rules:

```text
- Server-generated prompts only.
- No vendor raw prompts in MVP.
- No competitor screenshots as image inputs.
- No competitor names in prompts.
- No "in the style of <competitor>".
- No clean competitor assets as references.
- No CatalogItem card images sent to GPT Image 2.
- No card faces, card names, card text, logos, official marks, characters, fake UI, odds, discounts, scarcity claims, endorsements, or readable CTA text.
- Background/ambience only.
```

Safe prompt direction:

```text
Create an abstract ecommerce campaign banner background for a collectible-card mystery-pack storefront.
Mood: premium collector drop, energetic, glossy, high contrast.
Scene: abstract display stage with layered gradients, soft foil sparkle, rim lighting, and clean negative space.
Composition: leave clear empty space for deterministic headline and CTA. Leave open display area for exact card images to be composited later.
Constraints: no readable text, no logos, no characters, no trading card faces, no product claims, no fake UI, no endorsement symbols, no competitor-specific layout.
```

## Compositor constraints

Use:

- Oripa-owned design tokens
- fixed safe zones
- exact source-backed `CatalogItem` images
- deterministic typography
- allowlisted CTA labels
- fixed card slot rules
- fixed shadow/glow/stroke rules
- crop-aware desktop/mobile exports
- similarity review before approval/publish

Do not use:

- competitor screenshot coordinates
- competitor-specific color stack
- exact CTA shape/position if distinctive
- competitor badges/ribbons/labels
- copied hierarchy or trade dress
- downloaded competitor backgrounds
- AI-redrawn cards
- AI-generated final text

## Explicit blocks

Block until approval:

- downloading clean Clove banner assets at scale
- uploading Clove screenshots/assets to GPT Image 2
- uploading Clove screenshots/assets to ad-hoc GPT/Oracle without legal/product/data-control approval
- using Clove screenshots as direct implementation references
- template keys/prompts/comments/tickets containing `Clove-style` or `like Clove`
- copying exact layouts, CTA treatments, badge treatments, campaign copy, visual hierarchy, color combinations, or trade dress
- storing competitor assets in repo, seed data, tests, public buckets, template fixtures, or prompt snapshots
- publishing any generated asset that a reasonable reviewer would describe as competitor-like
- publishing banners with exact Pokémon/TCG card imagery until legal/product approval clears
- AI generation of card faces/logos/card text/odds/discounts/endorsement claims/campaign mechanics
- vendor raw prompts
- auto-publish
- live DB migrations or production write paths without existing migration/write gates

## Oracle evidence

Oracle response artifact:

`/home/yeqiuqiu/.hermes/profiles/coding/state/oracle_consults/20260529T073001Z_oripa-creative-reference-capture-reconcile/oracle_response.md`
