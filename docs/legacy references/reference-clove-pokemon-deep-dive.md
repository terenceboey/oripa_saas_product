# Clove Oripa Pokemon Reference Deep Dive

Source: https://oripa.clove.jp/en/oripa/Pokemon
Captured: 2026-05-28 from public web + public GraphQL calls.

## Executive summary

Clove's Pokemon Oripa storefront is not just a pack grid. It is a mature consumer gacha/oripa product with:

- A category storefront with search/sort/filter/tag state, campaign banners, recommended/new-user rails, infinite pagination, and behavioral analytics.
- Product detail pages centered on a video-backed draw experience, lineups split by prize grade (`FIRST`, `SECOND`, `THIRD`, `FOURTH`, plus `LAST_ONE`, `ROUND_NUMBER`, `EXTRA`).
- Multiple draw modes: legacy draw, V2 draw, draw remaining/last-one, demo gacha, daily gates, rank gates, beginner gates, user-specific gates, and RUSH ticket loops.
- A wallet/point economy integrated with Stripe, PayPay, GMO Pay, promotion codes, coupons, rank, notifications, prize return-to-points, shipping, and address management.
- Inventory/fulfillment metadata per prize: `prizeLocationName` (`JAPAN`, `HONG_KONG`, `VIRTUAL`), `isShippingOnly`, `returnAmount`, collectible variant IDs, item condition, card number (`kataban`), multilingual names, and reference prices.

Our local `oripa_saas` repo already has the right high-level spine: multi-tenant vendors, packs/prizes, wallet ledger, idempotent draw orders, serializable draw transaction, stock decrement, audit/outbox, and provably fair HMAC proof. The gap is product depth: categories/tags, prize grade taxonomy, lineups, draw result UX contract, special bonuses, user gates, payment/top-up flows, fulfillment, and admin data model.

## Public architecture observed

### Frontend stack

- Next.js app under `https://oripa.clove.jp`.
- Build routes expose:
  - `/oripa/[category]`
  - `/oripa/[category]/[oripaId]`
  - `/oripa/[category]/[oripaId]/result`
  - payment, point, shipping, phone-number, overseas shipping guide, rank help routes.
- Uses Chakra-like component system, React Query, urql/Apollo-style GraphQL operations, Algolia client, Statsig experiments, Firebase/Auth custom token flows, Google/Twilio integrations, recaptcha, Swiper banners, HLS lottery videos.

### API endpoints

Public JS contains API hosts:

- `https://api.prd.oripa.clove.jp`
- `https://api-hk.prd.oripa.clove.jp`
- Also generic Clove endpoints: `https://api.prd.clove.jp`, `https://api-hk.prd.clove.jp`

Public category calls were made to GraphQL endpoint:

- `POST https://api.prd.oripa.clove.jp/graphql`

Important GraphQL operations found in bundles:

- Storefront/listing:
  - `orderedOripasWithPagination`
  - `newUserOripas`
  - `jsonLdOripas`
  - `oripasRecommended`
  - `relatedOripas`
  - `Tags`
  - `CampaignBanners`
- Detail:
  - `getOripaByID`
  - `displayedPrizesByOripaIdAndPrizeType`
  - `displayedPrizesForDemoGacha`
  - `getOripaExtraPrizeRateById`
- Draw:
  - `drawLotteriesAndGetPrizes`
  - `drawOripaV2`
  - `drawRemainingLotteriesAndGetPrizes`
  - `dailyOripaIsDrawn`
  - `oripaAllowedUser`
  - `canAccessRankLimitedOripa`
- Rush:
  - `Rushes`
  - `GetRushDetail`
  - `GetRushByTicketPrizeID`
  - `streakRushDraw`
  - `streakRushDrawAll`
  - `streakRushResult`
  - `consumeAllUnusedRushTickets`
  - `userUnusedRushTicketCount`
- Wallet/payment:
  - `getCurrentPointByUserID`
  - `getStripeCheckoutSession`
  - `paypayQrCodeCreate`
  - `paypayConfirmPaymentStatusCode`
  - `gmoPayCreateCharge`
  - `gmoPayGetPaymentDetail`
  - `purchasePointCoupons`
  - `promotionCodeApply`
  - `getExchangeRates`
- Prize/fulfillment:
  - `userPrizeHistories`
  - `prizesReductAndShip`
  - `prizeCancelShippingAndConvertToPoint`
  - `checkShippingPayment`
  - `UserShippingAddress`, `UserAddressRegister/Edit/Delete/ChangeDefault`
- Account:
  - `SignUp`, `createUserIfNotExist`, `AuthCustomTokenCodeGenerate`
  - `TwilioSmsVerification*`, `VerifyPhoneNumber`
  - `UserEmailVerificationTokenSend/Verify`
  - `updateDisplayName`, `updateUserIcon`
  - `notifications`, `unreadNotificationCount`, `NotificationRead`

## Storefront page behavior

Observed page: `/en/oripa/Pokemon`.

### Category taxonomy

Public frontend category enum:

- `All`
- `Rush`
- `Appraised`
- `Pokemon`
- `OnePiece`
- `Hobby`
- `Figure`
- `Yugioh`
- `WeissSchwarz`

Internal category enum observed:

- `POKEMON`
- `ONE_PIECE`
- `YUGIOH`
- `WEISS_SCHWARZ`
- `DRAGON_BALL_SUPER_CARD_GAME`
- `DUEL_MASTERS`
- `MTG`
- `FIGURE`
- `HOBBY`

### Sort modes

Frontend sort enum:

- `RECOMMEND`
- `LOW_REMAINING_RATE`
- `NEWEST`
- `POPULARITY`
- `PRICE_DESC`
- `PRICE_ASC`

The category page persists sort in `sessionStorage` under `oripaSortKind` and selected top tags under `oripaTopTagIds`.

Observed GraphQL request shape:

```graphql
query orderedOripasWithPagination(
  $where: OrderedOripasWhereInput!
  $sort: OripaSortEnum!
  $first: Int
  $after: String
) {
  orderedOripasWithPagination(where: $where, sort: $sort, first: $first, after: $after) {
    nodes { ...OripaLabelFields }
    pageInfo { hasNextPage hasPreviousPage endCursor }
    totalCount
  }
}
```

Typical variables:

```json
{
  "where": {
    "category": "POKEMON",
    "tagIds": [],
    "selectedLanguage": "en"
  },
  "sort": "RECOMMEND",
  "first": 30,
  "after": null
}
```

### Storefront data stats captured

For Pokemon, public GraphQL returned:

- Total active/listed packs: `146`
- Fetched pages: 5 pages x 30 per page.
- Price range: min `5`, median `8888`, max `250000` points.
- Quantity range: min `50`, median `3750`, max `2000000` entries.
- Aggregate remaining/quantity ratio at capture: about `0.643`.

Feature flags among the 146 Pokemon packs:

- `isOripaV2`: 36
- `isDemoGachaDisabled`: 15
- `hasShippingOnlyPrize`: 2
- `forNewUser`: 10
- `isDaily`: 3
- `hasLastOne`: 15

Top observed tags:

- High Chance Profit: 96
- Charizard: 83
- Umbreon: 64
- GX: 63
- PSA10 Guaranteed: 49
- Appraised Items: 49
- BOX: 49
- New: 48
- Gengar: 39
- Final Drawer Bonus: 15
- Pikachu: 10
- RUSH Ticket: 10
- Beginner Only: 10
- Min 60% Guaranteed: 8
- Lillie: 4
- Once per Day: 3
- Nearly Sold Out: 1

### Example top recommended products

- `cmpkkvxlxh30ds601vsutr84l`: `PSA10確定 伝説PSA10多数降臨`; price `10000`; remaining/quantity around `34158/40000`; tags include PSA10 Guaranteed, Pikachu, High Chance Profit, Umbreon, Gengar, New, Charizard, GX, Min 60% Guaranteed, Appraised Items.
- `cmpkpqsy5024js601li4422x1`: `実質3ptでBOXを掴み取れ`; price `5`; remaining/quantity around `52297/2000000`; tags High Chance Profit, New, Nearly Sold Out, BOX.
- `cmpgn72kub8pqs601nbw3c4wg`: `7ptで超激熱`; price `7`; remaining/quantity around `196022/1890000`.
- `cmpg8le8z637rs601p97bv02q`: `ピカチュウが好きに決まってる`; price `10`; remaining/quantity around `780383/2000000`.
- `cmpp7djv820vhs601md1fqxrz`: `RUSH祭大口 連撃`; price `11`; remaining/quantity around `1833618/2000000`.

## Detail page behavior

Example detail URL:

- `https://oripa.clove.jp/en/oripa/Pokemon/cmpkkvxlxh30ds601vsutr84l`

Page title pattern:

- `Pokémon Mystery Pack {name} | Clove Mystery Pack`

Public content observed:

- Video hero: HLS/video-backed draw animation. If not playable, SSR/extractor shows `Unable to load video.`
- Sign-up/login CTA: `Sign Up / Login`, `Sign up for 500pt & Up to 90% OFF Coupon!`
- Thumbnail image through Next image optimizer.
- Tag badges.
- Time and per-user limit messaging, e.g. limited-time sale until a date/time and max entries/person.
- Prize lineup sections by grade: `1st Prize`, `2nd Prize`, etc.
- Each displayed prize shows condition, quantity, image, localized description, sub-description/rarity, kataban/card code.

### `getOripaByID` shape

Important fields returned:

- `category`, `isR18`, `createdAt`, `updatedAt`
- `id`, `name`, `nameLogo`, `nameHidden`
- `price`, `quantity`, `remaining`, `publishStatus`
- `thumbnail`, `subImages`
- `video`, `videoID`
- `extraPrizeThreshold`
- `forNewUser`
- `isDaily`, `isUserLimited`, `hasLastOne`
- `roundNumber`
- `requiredRankName`
- `openAt`, `showCountdownBeforeOpen`, `closeAt`
- `forUsa`, `hkStartedAt`
- `maxDrawsPerUser`, `userDrawCountForLimit`
- `isJackpotPointExcluded`
- `isDemoGachaDisabled`, `isOripaV2`
- `hasShippingOnlyPrize`
- `prizeLocationNamesForClient`
- `cachedTags` with localized titles and badge colors
- lineups:
  - `firstDisplayedPrizesForLineup`
  - `secondDisplayedPrizesForLineup`
  - `thirdDisplayedPrizesForLineup`
  - `fourthDisplayedPrizesForLineup`
  - `extraDisplayedPrizesForLineup`
  - `roundNumberDisplayedPrizesForLineup`
  - `lastOneDisplayedPrizesForLineup`

Displayed prize fields:

- `id`
- `prizeType`: `FIRST`, `SECOND`, `THIRD`, `FOURTH`, `EXTRA`, `ROUND_NUMBER`, `LAST_ONE`
- `mainDescription`, `mainDescriptionEn`
- `subDescription`
- `kataban`
- `imageUrl`
- `condition`: examples `PSA10`, `RAW5`
- `quantity`
- `isShippingOnly`
- `collectibleVariantID`
- `prizeLocationName`: `JAPAN`, `HONG_KONG`, `VIRTUAL`
- `referencePriceInfo`: `isReferencePriceTarget`, `referencePrice`, `referencePriceUpdatedAt`

### Example product details

#### PSA10 guaranteed pack

ID: `cmpkkvxlxh30ds601vsutr84l`

- Name: `PSA10確定 伝説PSA10多数降臨`
- Price: `10000`
- Quantity: `40000`
- Remaining at capture: around `34164`
- `maxDrawsPerUser`: `4000`
- `isOripaV2`: `true`
- `isDemoGachaDisabled`: `false`
- `hasLastOne`: `false`
- Prize locations: `JAPAN`, `HONG_KONG`
- Lineups observed:
  - 1st: 4 displayed prizes, all quantity 1, PSA10 Poncho Pikachu variants.
  - 2nd: 31 displayed prizes, quantity 1, high-end PSA10 chase cards.
  - 3rd: 13 displayed prize examples, often quantity null for random/bucket prizes.
  - 4th: 2 displayed prizes, random PSA10 AR etc.

#### Ultra-low price BOX hook

ID: `cmpkpqsy5024js601li4422x1`

- Name: `実質3ptでBOXを掴み取れ`
- Price: `5`
- Quantity: `2000000`
- Remaining at capture: around `53012`
- `isOripaV2`: `true`
- Prize locations: `JAPAN`, `HONG_KONG`
- Product positioning: tiny point cost, huge pool, BOX chase, almost sold out.
- Lineups:
  - 1st: sealed BOXes such as 25th ANNIVERSARY COLLECTION, Fusion Arts, Lost Abyss.
  - 2nd: many sealed BOXes.
  - Lower grades include regular cards/random damaged card fillers.

#### RUSH ticket product

ID: `cmpp7geolb7y1s601qktnkktr`

- Name: `RUSH祭 RUSH確定`
- Price: `250000`
- Quantity: `100`
- Remaining: `100`
- `isDemoGachaDisabled`: `true`
- `isOripaV2`: `true`
- Prize location: `VIRTUAL`
- All displayed prizes are RUSH tickets, not physical cards.
- Tags: High Chance Profit, RUSH Ticket, New.

## Draw flow contract

Two primary draw mutations are present.

Legacy:

```graphql
mutation drawLotteriesAndGetPrizes($input: DrawInput!) {
  drawLotteriesAndGetPrizes(drawInput: $input) {
    grades
    videoUrl
    roundNumberPrize { ...PrizeResult }
    lastOnePrize { ...PrizeResult }
    extraPrizes { ...PrizeResult }
    prizes {
      ...PrizeResult
      lottery { grade }
    }
  }
}
```

V2:

```graphql
mutation drawOripaV2($input: DrawOripaV2Input!) {
  drawOripaV2(drawOripaV2Input: $input) {
    grades
    videoUrl
    roundNumberPrize { ...PrizeResult }
    lastOnePrize { ...PrizeResult }
    extraPrizes { ...PrizeResult }
    prizes {
      ...PrizeResult
      lottery { grade }
    }
  }
}
```

Result prize fields:

- `id`
- `prizeLocationName`
- `parsedPrizeData`:
  - `mainDescription`
  - `mainDescriptionEn`
  - `subDescription`
  - `kataban`
  - `imageUrl`
  - `category`
- `returnAmount`
- `isShippingOnly`
- `isRushTicket`
- `lottery.grade`

Client-side detail page logic splits results into:

- Normal prizes: `!isRushTicket`
- RUSH tickets: `isRushTicket`
- Round-number prize: separate, unless it is a RUSH ticket.
- Last-one prize: separate, unless it is a RUSH ticket.
- Extra prizes: separate list, split by RUSH/non-RUSH.

Status gates found in product label code:

- `SOLD_OUT`: `remaining === 0`
- `LIMIT_REACHED`: user draw quota left <= 0
- `LOADING`
- `DAILY_DRAWN`
- `RANK_LOCKED`
- `NOT_TARGET_USER`
- `BEFORE_RELEASE`

## Special mechanics to model

### New-user packs

`newUserOripas` returns beginner-only packs. Observed fields:

```json
"forNewUser": {
  "displayOrder": 1,
  "buyAmountLimit": 1000000,
  "daysAfterRegistration": 1
}
```

Observed new-user packs had:

- `maxDrawsPerUser`: often 1
- Tags: `Beginner Only`, `Min 60% Guaranteed`, `High Chance Profit`, sometimes `BOX`
- Prices: e.g. 500, 2000, 5000 points

### Daily packs

Flags:

- `isDaily`
- GraphQL check: `dailyOripaIsDrawn(oripaInput: { oripaID }) { isDrawn }`

### Rank-limited packs

Fields/queries:

- `requiredRankName`
- `canAccessRankLimitedOripa($id)` -> `canAccessLimitedOripa(oripaID: $id) { canAccess }`

Rank enum in bundle:

- `BEGINNER`
- `BRONZE`
- `SILVER`
- `GOLD`
- `PLATINUM`
- `DIAMOND`
- `LEGEND`

### User-limited/targeted packs

Fields/queries:

- `isUserLimited`
- `oripaAllowedUser(oripaID: $id) { id }`

### Last-one/final-drawer bonus

Fields:

- `hasLastOne`
- `lastOneDisplayedPrizesForLineup`
- Draw result includes `lastOnePrize`.

### Round-number prizes

Fields:

- `roundNumber`
- `roundNumberDisplayedPrizesForLineup`
- Draw mutation input has `isForRoundNumber` in client snippet.
- Draw result includes `roundNumberPrize`.

### Extra prizes / threshold

Fields:

- `extraPrizeThreshold`
- `extraDisplayedPrizesForLineup`
- Query: `getOripaExtraPrizeRateById`
- Draw result includes `extraPrizes`.

### RUSH tickets

Virtual prize loop. Observed:

- Products tagged `RUSH Ticket`.
- Prize location `VIRTUAL`.
- `isRushTicket` in draw result.
- Queries/mutations for RUSH ticket inventory and consumption.

### Demo gacha

Fields/functions:

- `isDemoGachaDisabled`
- `displayedPrizesForDemoGacha`
- Frontend stores demo data in session storage keys like `demoGachaResult`, `demoGachaReferrer`, `oripaDemoGachaOripaID`.
- Demo logic can synthesize result from displayed prizes without consuming real inventory.

## Wallet, points, payment, and fulfillment

Clove has separate concerns:

- Point balance: `getCurrentPointByUserID`
- Top-up/payment:
  - Stripe checkout session
  - PayPay QR creation and status check
  - GMO Pay charge and detail
  - payment option persisted under `oripaPaymentOption`
- Promotion/coupons:
  - `promotionCodeApply`
  - `purchasePointCoupons`
  - coupon/rank refresh session keys
- Prize history:
  - `userPrizeHistories`
  - `userHighValuePrizeWinResults`
- Fulfillment:
  - `prizesReductAndShip`
  - `prizeCancelShippingAndConvertToPoint`
  - `checkShippingPayment`
  - addresses and default shipping address CRUD
- International fulfillment:
  - `prizeLocationName` per prize
  - page route `/others/overseas-shipping-guide`

## Local `oripa_saas` comparison

### Current strengths in local repo

Confirmed from local code:

- Monorepo with npm workspaces: shared/api/web/worker.
- Prisma PostgreSQL schema.
- Vendor/tenant model with `host`, `slug`, active flag, settings.
- Pack/prize model with stock and estimated value.
- Wallet account + immutable entries.
- Draw order/result/fairness proof/fairness selection models.
- Idempotency via `IdempotencyKey.scopeKey`.
- Serializable transaction in draw API.
- HMAC-SHA256 deterministic selection and pool snapshot hash.
- Audit logs and outbox events.
- Payment/top-up ledger scaffolding.
- Render deployment scaffold.

Key files:

- `prisma/schema.prisma`
- `apps/api/src/modules/draws/router.ts`
- `apps/api/src/modules/packs/router.ts`
- `apps/web/app/page.tsx`
- `packages/shared/src/index.ts`

### Important gaps vs Clove

#### 1. Storefront model is too flat

Current local model has:

- `Pack.title`, `pricePoints`, `totalStock`, `remainingStock`, `isNew`, `limitedLabel`, `startsAt`, `endsAt`.

Needed for Clove-like parity:

- Category enum and category-specific slugs.
- Tag model with localized titles, category, badge color, display order.
- Many-to-many pack tags.
- Sort rank/recommendation fields.
- Thumbnail, sub-images, name logo, hidden-name flag.
- Open/close times and countdown behavior.
- `publishStatus`, `isR18`, `isAppraised`, region flags.
- Per-user max draw limits and draw-count tracking.
- `isDaily`, `isUserLimited`, `requiredRankName`, `forNewUser` gate config.
- `isDemoGachaDisabled`, `isOripaV2`, `isJackpotPointExcluded`.

#### 2. Prize model lacks lineup/grade semantics

Current `PackPrize` has `label`, `imageUrl`, `estimatedValue`, `weight`, `stock`, `remainingStock`.

Needed:

- `prizeType`: FIRST/SECOND/THIRD/FOURTH/EXTRA/ROUND_NUMBER/LAST_ONE.
- `mainDescription`, `mainDescriptionEn`, localized variants.
- `subDescription` rarity.
- `kataban` card code.
- `condition`: PSA10/RAW5/Sealed/etc.
- `quantity` display count separate from stock/weight.
- `referencePriceInfo`.
- `collectibleVariantId`.
- `prizeLocationName`: JAPAN/HONG_KONG/VIRTUAL.
- `isShippingOnly`.
- `isRushTicket` or a `PrizeKind` enum.
- Return-to-points amount.

#### 3. Draw API response is not product-UX-compatible yet

Current local draw returns draw IDs/prize IDs/prize labels and fairness metadata.

Clove-style client expects:

- `grades[]`
- `videoUrl`
- result prizes with parsed prize data, return amount, shipping-only flag, RUSH ticket flag, lottery grade.
- Separate `roundNumberPrize`, `lastOnePrize`, `extraPrizes`, `prizes`.
- Result page route and persisted selected shipping prize IDs.

#### 4. Special mechanics missing

Need implement or explicitly cut from MVP:

- New-user packs with days-after-registration and buy amount limit.
- Daily draw gating.
- Rank-limited packs.
- User-targeted pack allowlist.
- Last-one bonus.
- Round-number bonus.
- Extra threshold prizes.
- Draw remaining / buyout flow.
- Demo gacha.
- RUSH tickets and virtual prize loops.

#### 5. Wallet endpoint bug / MVP issue

Local `GET /v1/wallet` currently does:

```ts
findFirst({ where: { vendorId: req.vendorId } })
```

It does not filter by authenticated user. In multi-user production, wallet reads must be `vendorId + actorUserId`, same as draw debit.

#### 6. Storefront UI is prototype-grade

Local Next page has:

- Static categories only.
- Client-side sorting only.
- No pagination.
- No tags/filter drawer.
- No Clove-style detail page contract.
- No video/draw animation/result page matching.
- No prize history/ship/return-to-points flows.

## Recommended implementation roadmap

### Phase 1: Data model parity foundation

Add enums/models without implementing every mechanic yet:

- `Category`, `PackPublishStatus`, `PrizeType`, `PrizeLocation`, `PrizeCondition`, `RankName`, `PrizeKind`.
- `Tag`, `PackTag`.
- Extend `Pack` with category, thumbnail, subImages JSON, recommendation rank, user gates, open/close times, special flags.
- Extend/split `PackPrize` into display fields and operational fields.
- Add `UserPackDrawLimit`/draw-count aggregate or queryable index.
- Add `UserPrize` inventory table for post-draw ownership/fulfillment.

### Phase 2: API contract parity

Add endpoints aligned to Clove UX but REST-native:

- `GET /v1/oripas?category=POKEMON&sort=RECOMMEND&tagIds=&cursor=`
- `GET /v1/oripas/new-user?category=POKEMON`
- `GET /v1/oripas/:id`
- `POST /v1/oripas/:id/draw`
- `GET /v1/oripas/:id/eligibility`
- `GET /v1/user/prizes`
- `POST /v1/user/prizes/:id/return-points`
- `POST /v1/user/prizes/ship`

Keep current provably fair proof model, but return Clove-like draw result shape.

### Phase 3: UX clone priority

Build in this order:

1. Category storefront grid with tags, sorts, cursor pagination, cards showing price/remaining/tags.
2. Detail page with hero/thumbnail, tags, gates, draw counts, lineups by prize type.
3. Draw modal/result page with video placeholder and separated normal/RUSH/bonus prizes.
4. User prize inventory with ship vs convert-to-points.
5. Payment/top-up flow.
6. Admin CMS for pack/prize/tag/banner creation.

### Phase 4: Special mechanics

Implement mechanically after the base draw path is stable:

- Last-one.
- Round-number.
- Extra threshold prizes.
- Daily/new-user/rank/user gates.
- Demo gacha.
- RUSH tickets.

## Suggested local schema additions sketch

```prisma
enum OripaCategory {
  POKEMON
  ONE_PIECE
  YUGIOH
  WEISS_SCHWARZ
  DRAGON_BALL_SUPER_CARD_GAME
  DUEL_MASTERS
  MTG
  FIGURE
  HOBBY
}

enum PackPublishStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum PrizeType {
  FIRST
  SECOND
  THIRD
  FOURTH
  EXTRA
  ROUND_NUMBER
  LAST_ONE
}

enum PrizeLocationName {
  JAPAN
  HONG_KONG
  VIRTUAL
}

enum RankName {
  BEGINNER
  BRONZE
  SILVER
  GOLD
  PLATINUM
  DIAMOND
  LEGEND
}

model Tag {
  id           String   @id @default(cuid())
  vendorId     String
  identifier   String
  category     OripaCategory?
  titleJa      String
  titleEn      String?
  badgeColor   String?
  displayOrder Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([vendorId, identifier])
  @@index([vendorId, category, displayOrder])
}
```

Add to `Pack`:

```prisma
category              OripaCategory @default(POKEMON)
publishStatus         PackPublishStatus @default(DRAFT)
thumbnailUrl          String?
subImages             Json?
nameLogoUrl           String?
nameHidden            Boolean @default(false)
isR18                 Boolean @default(false)
isAppraised           Boolean @default(false)
isDaily               Boolean @default(false)
isUserLimited         Boolean @default(false)
requiredRankName      RankName?
maxDrawsPerUser       Int?
showCountdownBeforeOpen Boolean @default(false)
forNewUser            Json?
hasLastOne            Boolean @default(false)
roundNumber           Int?
extraPrizeThreshold   Int?
isDemoGachaDisabled   Boolean @default(false)
isOripaV2             Boolean @default(true)
hasShippingOnlyPrize  Boolean @default(false)
recommendationRank    Int @default(0)
```

Add to `PackPrize`:

```prisma
prizeType             PrizeType @default(FOURTH)
mainDescription       String
mainDescriptionEn     String?
subDescription        String?
kataban               String?
condition             String?
displayQuantity       Int?
collectibleVariantId  String?
prizeLocationName     PrizeLocationName @default(JAPAN)
isShippingOnly        Boolean @default(false)
isRushTicket          Boolean @default(false)
returnAmountPoints    Int @default(0)
referencePrice        Int?
referencePriceUpdatedAt DateTime?
displayOrder          Int @default(0)
```

## MVP product decisions

If we want a fast usable Oripa SaaS MVP, copy Clove's *shape*, not every mechanic:

Must-have:

- Category/tag storefront.
- Product detail with grade lineups.
- Wallet + draw + inventory.
- Ship/return-to-points decision.
- Admin pack/prize CRUD.
- Provably fair proof retained from local implementation.

Defer:

- RUSH ticket loops.
- Rank system.
- Daily/new-user gates beyond simple per-user limit.
- Video/HLS production pipeline.
- Multi-country fulfillment fees.
- Algolia/Statsig/Firebase complexity.

Critical fix before real users:

- Wallet endpoint must be user-scoped.
- Draw API should record user-owned prizes, not only draw result rows.
- Pack stock and prize stock must be locked safely under concurrent draw load.
- Public list/detail API should not expose operational weights if the business wants only displayed rates/lineups; fairness proof can reveal immutable snapshot after draw.
