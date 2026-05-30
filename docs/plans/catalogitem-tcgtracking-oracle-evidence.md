## prisma/schema.prisma

### lines 585-640

585|model CatalogItem {
586|  id             String          @id @default(cuid())
587|  source         String
588|  sourceItemId   String
589|  itemType       CatalogItemType @default(CARD)
590|  game           String          @default("POKEMON")
591|  language       String          @default("en")
592|  name           String
593|  setId          String?
594|  setName        String?
595|  localId        String?
596|  cardNumber     String?
597|  rarity         String?
598|  imageBaseUrl   String?
599|  imageThumbUrl  String?
600|  imageLargeUrl  String?
601|  searchText     String
602|  sourcePayload  Json?
603|  isActive       Boolean         @default(true)
604|  createdAt      DateTime        @default(now())
605|  updatedAt      DateTime        @updatedAt
606|
607|  @@unique([source, sourceItemId, language])
608|  @@index([itemType, game, isActive])
609|  @@index([source, isActive])
610|  @@index([game, language, isActive])
611|  @@index([setId])
612|  @@index([name])
613|}

### lines 450-530

450|  id                     String           @id @default(cuid())
451|  vendorId               String
452|  userId                 String?
453|  walletAccountId        String
454|  pointsToCredit         Int
455|  expectedCurrencyAmount Decimal?         @db.Decimal(18, 2)
456|  currencyCode           String?
457|  status                 TopupOrderStatus @default(PENDING)
458|  provider               String?
459|  providerOrderRef       String?
460|  requestId              String?
461|  idempotencyScopeKey    String?
462|  metadata               Json?
463|  createdAt              DateTime         @default(now())
464|  updatedAt              DateTime         @updatedAt
465|  Vendor                 Vendor           @relation(fields: [vendorId], references: [id], onDelete: Cascade)
466|  user                   User?            @relation(fields: [userId], references: [id], onDelete: SetNull)
467|  walletAccount          WalletAccount    @relation(fields: [walletAccountId], references: [id], onDelete: Restrict)
468|
469|  @@index([vendorId, createdAt])
470|  @@index([provider, providerOrderRef])
471|}
472|
473|model PaymentTransaction {
474|  id                 String                   @id @default(cuid())
475|  vendorId           String
476|  userId             String?
477|  topupOrderId       String?
478|  provider           String
479|  providerPaymentRef String?
480|  status             PaymentTransactionStatus @default(INITIATED)
481|  amountCurrency     Decimal?                 @db.Decimal(18, 2)
482|  currencyCode       String?
483|  rawPayload         Json?
484|  requestId          String?
485|  createdAt          DateTime                 @default(now())
486|  updatedAt          DateTime                 @updatedAt
487|  Vendor             Vendor                   @relation(fields: [vendorId], references: [id], onDelete: Cascade)
488|  user               User?                    @relation(fields: [userId], references: [id], onDelete: SetNull)
489|
490|  @@index([vendorId, createdAt])
491|  @@index([provider, providerPaymentRef])
492|}
493|
494|model AuditLog {
495|  id          String   @id @default(cuid())
496|  vendorId    String?
497|  actorUserId String?
498|  action      String
499|  entityType  String
500|  entityId    String?
501|  requestId   String?
502|  ipAddress   String?
503|  userAgent   String?
504|  beforeState Json?
505|  afterState  Json?
506|  metadata    Json?
507|  createdAt   DateTime @default(now())
508|  Vendor      Vendor?  @relation(fields: [vendorId], references: [id], onDelete: SetNull)
509|  actorUser   User?    @relation(fields: [actorUserId], references: [id], onDelete: SetNull)
510|
511|  @@index([vendorId, createdAt])
512|  @@index([actorUserId, createdAt])
513|  @@index([requestId])
514|}
515|
516|model OutboxEvent {
517|  id            String       @id @default(cuid())
518|  vendorId      String?
519|  aggregateType String
520|  aggregateId   String
521|  eventType     String
522|  payload       Json
523|  status        OutboxStatus @default(PENDING)
524|  attempts      Int          @default(0)
525|  nextAttemptAt DateTime?
526|  lastError     String?
527|  requestId     String?
528|  createdAt     DateTime     @default(now())
529|  updatedAt     DateTime     @updatedAt
530|  Vendor        Vendor?      @relation(fields: [vendorId], references: [id], onDelete: SetNull)

### lines 1-80

1|generator client {
2|  provider = "prisma-client-js"
3|}
4|
5|datasource db {
6|  provider = "postgresql"
7|  url      = env("DATABASE_URL")
8|}
9|
10|enum WalletEntryType {
11|  CREDIT
12|  DEBIT
13|}
14|
15|enum UserStatus {
16|  ACTIVE
17|  SUSPENDED
18|  DELETED
19|}
20|
21|enum EmailVerificationStatus {
22|  PENDING
23|  VERIFIED
24|}
25|
26|enum VendorMembershipRole {
27|  OWNER
28|  MANAGER
29|  STAFF
30|}
31|
32|enum DrawOrderStatus {
33|  COMPLETED
34|  FAILED
35|  CANCELLED
36|}
37|
38|enum RevenueEntryType {
39|  DRAW_GROSS
40|  PLATFORM_FEE
41|  TENANT_NET
42|  ADJUSTMENT
43|}
44|
45|enum TopupOrderStatus {
46|  PENDING
47|  COMPLETED
48|  FAILED
49|  CANCELLED
50|}
51|
52|enum PaymentTransactionStatus {
53|  INITIATED
54|  AUTHORIZED
55|  CAPTURED
56|  FAILED
57|  REFUNDED
58|}
59|
60|enum OutboxStatus {
61|  PENDING
62|  DISPATCHED
63|  FAILED
64|}
65|
66|enum VendorPlanCode {
67|  BASIC
68|  ELITE
69|}
70|
71|enum PackStatus {
72|  DRAFT
73|  LIVE
74|  ARCHIVED
75|}
76|
77|enum DrawLimitMode {
78|  NONE
79|  ONCE_PER_CUSTOMER
80|  DAILY_RESET

## apps/api/src/modules/catalog/router.ts

### lines 1-140

1|import { Router } from "express";
2|import { CatalogItemType } from "@prisma/client";
3|import { z } from "zod";
4|import { prisma } from "../../lib/prisma";
5|import { VendorRequest } from "../../middleware/vendor";
6|import { getRequestUserId, getVendorMembershipRole } from "../../lib/rbac";
7|
8|export const catalogRouter = Router();
9|
10|const searchQuerySchema = z.object({
11|  q: z.string().trim().min(2).max(120),
12|  limit: z.coerce.number().int().min(1).max(30).optional().default(10),
13|  type: z.enum(["card", "sealed", "all"]).optional().default("card"),
14|  game: z.string().trim().max(40).optional().default("POKEMON"),
15|});
16|
17|async function requireVendorReadAccess(req: VendorRequest, res: any) {
18|  if (!req.vendorId) {
19|    res.status(400).json({ error: "Vendor not resolved" });
20|    return null;
21|  }
22|  const actorUserId = getRequestUserId(req);
23|  if (!actorUserId) {
24|    res.status(401).json({ error: "unauthorized" });
25|    return null;
26|  }
27|  const role = await getVendorMembershipRole({ vendorId: req.vendorId, userId: actorUserId });
28|  if (!role) {
29|    res.status(403).json({ error: "forbidden: insufficient vendor role" });
30|    return null;
31|  }
32|  return { vendorId: req.vendorId, actorUserId, role };
33|}
34|
35|catalogRouter.get("/v1/catalog/search", async (req: VendorRequest, res) => {
36|  const auth = await requireVendorReadAccess(req, res);
37|  if (!auth) return;
38|
39|  const parsed = searchQuerySchema.safeParse(req.query);
40|  if (!parsed.success) {
41|    return res.status(400).json({ error: "Invalid query", issues: parsed.error.issues });
42|  }
43|
44|  const { q, limit, type, game } = parsed.data;
45|  const typeFilter =
46|    type === "card"
47|      ? CatalogItemType.CARD
48|      : type === "sealed"
49|        ? CatalogItemType.SEALED_PRODUCT
50|        : undefined;
51|
52|  const byNameStarts = await prisma.catalogItem.findMany({
53|    where: {
54|      isActive: true,
55|      game,
56|      ...(typeFilter ? { itemType: typeFilter } : {}),
57|      name: { startsWith: q, mode: "insensitive" },
58|    },
59|    orderBy: [{ name: "asc" }],
60|    select: {
61|      id: true,
62|      source: true,
63|      sourceItemId: true,
64|      itemType: true,
65|      game: true,
66|      language: true,
67|      name: true,
68|      setId: true,
69|      setName: true,
70|      cardNumber: true,
71|      rarity: true,
72|      imageThumbUrl: true,
73|      imageLargeUrl: true,
74|      imageBaseUrl: true,
75|    },
76|    take: limit,
77|  });
78|
79|  const seenIds = new Set(byNameStarts.map((row) => row.id));
80|  const items = [...byNameStarts];
81|
82|  if (items.length < limit) {
83|    const byNameContains = await prisma.catalogItem.findMany({
84|      where: {
85|        isActive: true,
86|        game,
87|        ...(typeFilter ? { itemType: typeFilter } : {}),
88|        name: { contains: q, mode: "insensitive" },
89|        id: { notIn: [...seenIds] },
90|      },
91|      orderBy: [{ name: "asc" }],
92|      select: {
93|        id: true,
94|        source: true,
95|        sourceItemId: true,
96|        itemType: true,
97|        game: true,
98|        language: true,
99|        name: true,
100|        setId: true,
101|        setName: true,
102|        cardNumber: true,
103|        rarity: true,
104|        imageThumbUrl: true,
105|        imageLargeUrl: true,
106|        imageBaseUrl: true,
107|      },
108|      take: limit - items.length,
109|    });
110|
111|    for (const row of byNameContains) {
112|      seenIds.add(row.id);
113|      items.push(row);
114|    }
115|  }
116|
117|  if (items.length < limit) {
118|    const bySearchText = await prisma.catalogItem.findMany({
119|      where: {
120|        isActive: true,
121|        game,
122|        ...(typeFilter ? { itemType: typeFilter } : {}),
123|        searchText: { contains: q, mode: "insensitive" },
124|        id: { notIn: [...seenIds] },
125|      },
126|      orderBy: [{ name: "asc" }],
127|      select: {
128|        id: true,
129|        source: true,
130|        sourceItemId: true,
131|        itemType: true,
132|        game: true,
133|        language: true,
134|        name: true,
135|        setId: true,
136|        setName: true,
137|        cardNumber: true,
138|        rarity: true,
139|        imageThumbUrl: true,
140|        imageLargeUrl: true,

## apps/api/src/modules/packs/router.ts

### lines 1-260

1|import { Router } from "express";
2|import { createPackSchema, updatePackSchema } from "@oripa/shared";
3|import { Prisma } from "@prisma/client";
4|import { prisma } from "../../lib/prisma";
5|import { VendorRequest } from "../../middleware/vendor";
6|import { getRequestUserId, getVendorMembershipRole, hasRole } from "../../lib/rbac";
7|
8|export const packRouter = Router();
9|const DEFAULT_POKEMON_CARD_IMAGE = "https://archives.bulbagarden.net/media/upload/1/17/Cardback.jpg";
10|
11|type CreatePrizeRow = {
12|  label: string;
13|  imageUrl: string;
14|  weight: number;
15|  stock: number;
16|  remainingStock: number;
17|  estimatedValue: number;
18|};
19|
20|function decoratePackWithRates(pack: { prizes: Array<{ weight: number }> } & Record<string, unknown>) {
21|  const totalWeight = pack.prizes.reduce((sum, prize) => sum + prize.weight, 0);
22|  return {
23|    ...pack,
24|    prizes: pack.prizes.map((prize) => ({
25|      ...prize,
26|      dropRatePercent: totalWeight > 0 ? Number(((prize.weight / totalWeight) * 100).toFixed(4)) : 0,
27|    })),
28|  };
29|}
30|
31|function buildPrizeRows(data: {
32|  tiers?: Array<{
33|    name: string;
34|    percentage?: number;
35|    items: Array<{ label: string; estimatedValue: number; stock: number; imageUrl?: string }>;
36|  }>;
37|  prizes?: Array<{ label: string; imageUrl?: string; weight: number; stock: number; estimatedValue: number }>;
38|}) {
39|  let prizeRows: CreatePrizeRow[] = [];
40|
41|  if (data.tiers && data.tiers.length > 0) {
42|    const tiers = data.tiers;
43|
44|    const tiersWithPercent = tiers.filter((tier) => typeof tier.percentage === "number");
45|    const fixedPercentTotal = tiersWithPercent.reduce((sum, tier) => sum + (tier.percentage ?? 0), 0);
46|    if (fixedPercentTotal > 100) {
47|      throw new Error("Tier percentages exceed 100%");
48|    }
49|
50|    const tiersWithoutPercent = tiers.filter((tier) => typeof tier.percentage !== "number");
51|    const remainingPercent = Math.max(0, 100 - fixedPercentTotal);
52|    const fallbackTierPercent = tiersWithoutPercent.length > 0 ? remainingPercent / tiersWithoutPercent.length : 0;
53|
54|    for (const tier of tiers) {
55|      const tierPercent = tier.percentage ?? fallbackTierPercent;
56|      const perItemPercent = tier.items.length > 0 ? tierPercent / tier.items.length : 0;
57|      const itemWeight = Math.max(1, Math.round(perItemPercent * 100));
58|
59|      for (const item of tier.items) {
60|        prizeRows.push({
61|          label: `${tier.name} - ${item.label}`,
62|          imageUrl: item.imageUrl ?? DEFAULT_POKEMON_CARD_IMAGE,
63|          weight: itemWeight,
64|          stock: item.stock,
65|          remainingStock: item.stock,
66|          estimatedValue: item.estimatedValue,
67|        });
68|      }
69|    }
70|  } else if (data.prizes && data.prizes.length > 0) {
71|    prizeRows = data.prizes.map((prize) => ({
72|      label: prize.label,
73|      imageUrl: prize.imageUrl ?? DEFAULT_POKEMON_CARD_IMAGE,
74|      weight: prize.weight,
75|      stock: prize.stock,
76|      remainingStock: prize.stock,
77|      estimatedValue: prize.estimatedValue,
78|    }));
79|  } else {
80|    prizeRows = [
81|      {
82|        label: "A Tier - Chase",
83|        imageUrl: DEFAULT_POKEMON_CARD_IMAGE,
84|        weight: 10,
85|        stock: 1,
86|        remainingStock: 1,
87|        estimatedValue: 1000,
88|      },
89|      {
90|        label: "B Tier - Mid",
91|        imageUrl: DEFAULT_POKEMON_CARD_IMAGE,
92|        weight: 50,
93|        stock: 10,
94|        remainingStock: 10,
95|        estimatedValue: 250,
96|      },
97|      {
98|        label: "C Tier - Base",
99|        imageUrl: DEFAULT_POKEMON_CARD_IMAGE,
100|        weight: 200,
101|        stock: 100,
102|        remainingStock: 100,
103|        estimatedValue: 50,
104|      },
105|    ];
106|  }
107|
108|  return prizeRows;
109|}
110|
111|async function requirePackRole(req: VendorRequest, res: any, allowStaffReadOnly = false) {
112|  if (!req.vendorId) {
113|    res.status(400).json({ error: "Vendor not resolved" });
114|    return null;
115|  }
116|  const actorUserId = getRequestUserId(req);
117|  if (!actorUserId) {
118|    res.status(401).json({ error: "unauthorized" });
119|    return null;
120|  }
121|  const role = await getVendorMembershipRole({ vendorId: req.vendorId, userId: actorUserId });
122|  if (!role) {
123|    res.status(403).json({ error: "forbidden: insufficient vendor role" });
124|    return null;
125|  }
126|  if (!allowStaffReadOnly && !hasRole(role, ["OWNER", "MANAGER"])) {
127|    res.status(403).json({ error: "forbidden: insufficient vendor role" });
128|    return null;
129|  }
130|  return { vendorId: req.vendorId, actorUserId, role };
131|}
132|
133|packRouter.get("/v1/packs", async (req: VendorRequest, res) => {
134|  if (!req.vendorId) return res.status(400).json({ error: "Vendor not resolved" });
135|
136|  const now = new Date();
137|  const packRows = await prisma.pack.findMany({
138|    where: {
139|      vendorId: req.vendorId,
140|      isActive: true,
141|      status: "LIVE",
142|      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
143|      AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
144|    },
145|    include: { prizes: true },
146|    orderBy: { createdAt: "desc" },
147|  });
148|
149|  const packs = packRows.map((pack) => decoratePackWithRates(pack));
150|
151|  return res.json({ packs });
152|});
153|
154|packRouter.get("/v1/vendor/packs", async (req: VendorRequest, res) => {
155|  const auth = await requirePackRole(req, res, true);
156|  if (!auth) return;
157|
158|  const packRows = await prisma.pack.findMany({
159|    where: { vendorId: auth.vendorId, isActive: true },
160|    include: { prizes: true },
161|    orderBy: { createdAt: "desc" },
162|  });
163|
164|  return res.json({ packs: packRows.map((pack) => decoratePackWithRates(pack)) });
165|});
166|
167|packRouter.get("/v1/packs/:packId", async (req: VendorRequest, res) => {
168|  if (!req.vendorId) return res.status(400).json({ error: "Vendor not resolved" });
169|
170|  const packId = String(req.params.packId || "").trim();
171|  if (!packId) return res.status(400).json({ error: "packId is required" });
172|
173|  const pack = await prisma.pack.findFirst({
174|    where: { id: packId, vendorId: req.vendorId, isActive: true, status: { not: "ARCHIVED" } },
175|    include: { prizes: true },
176|  });
177|
178|  if (!pack) return res.status(404).json({ error: "Pack not found" });
179|  return res.json({ pack: decoratePackWithRates(pack) });
180|});
181|
182|async function createVendorPack(req: VendorRequest, res: any) {
183|  const auth = await requirePackRole(req, res);
184|  if (!auth) return;
185|
186|  const parsed = createPackSchema.safeParse(req.body);
187|  if (!parsed.success) {
188|    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
189|  }
190|
191|  const settings = await prisma.vendorSettings.findUnique({ where: { vendorId: auth.vendorId } });
192|  const maxPackItems = settings?.maxPackItems ?? 50;
193|  const maxPackTiers = settings?.maxPackTiers ?? 5;
194|
195|  const tierCount = parsed.data.tiers?.length ?? 0;
196|  if (tierCount > maxPackTiers) {
197|    return res.status(400).json({ error: `plan limit exceeded: max ${maxPackTiers} tiers` });
198|  }
199|
200|  const prizeRows = buildPrizeRows(parsed.data);
201|
202|  if (prizeRows.length > maxPackItems) {
203|    return res.status(400).json({ error: `vendor limit exceeded: max ${maxPackItems} items allowed in one draw pool` });
204|  }
205|
206|  const pack = await prisma.pack.create({
207|    data: {
208|      vendorId: auth.vendorId,
209|      title: parsed.data.title,
210|      pricePoints: parsed.data.pricePoints,
211|      totalStock: parsed.data.totalStock,
212|      remainingStock: parsed.data.totalStock,
213|      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
214|      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
215|      isNew: parsed.data.isNew,
216|      limitedLabel: parsed.data.limitedLabel,
217|      status: parsed.data.status ?? "DRAFT",
218|      importantNotes: parsed.data.importantNotes,
219|      drawLimitMode: parsed.data.drawLimitMode ?? "NONE",
220|      drawLimitValue: parsed.data.drawLimitValue,
221|      drawLimitResetTimezone: parsed.data.drawLimitResetTimezone,
222|      prizes: {
223|        createMany: {
224|          data: prizeRows,
225|        },
226|      },
227|    },
228|    include: { prizes: true },
229|  });
230|
231|  return res.status(201).json({ pack });
232|}
233|
234|packRouter.post("/v1/packs", createVendorPack);
235|packRouter.post("/v1/vendor/packs", createVendorPack);
236|
237|packRouter.patch("/v1/vendor/packs/:packId", async (req: VendorRequest, res) => {
238|  const auth = await requirePackRole(req, res);
239|  if (!auth) return;
240|  const packId = String(req.params.packId || "").trim();
241|  if (!packId) return res.status(400).json({ error: "packId is required" });
242|
243|  const parsed = updatePackSchema.safeParse(req.body);
244|  if (!parsed.success) {
245|    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
246|  }
247|
248|  const existing = await prisma.pack.findFirst({ where: { id: packId, vendorId: auth.vendorId, isActive: true } });
249|  if (!existing) return res.status(404).json({ error: "Pack not found" });
250|
251|  const settings = await prisma.vendorSettings.findUnique({ where: { vendorId: auth.vendorId } });
252|  const maxPackItems = settings?.maxPackItems ?? 50;
253|  const maxPackTiers = settings?.maxPackTiers ?? 5;
254|
255|  let replacementPrizeRows: CreatePrizeRow[] | null = null;
256|
257|  if ((parsed.data.tiers && parsed.data.tiers.length > 0) || (parsed.data.prizes && parsed.data.prizes.length > 0)) {
258|    const tierCount = parsed.data.tiers?.length ?? 0;
259|    if (tierCount > maxPackTiers) {
260|      return res.status(400).json({ error: `plan limit exceeded: max ${maxPackTiers} tiers` });

## apps/api/src/modules/draws/router.ts

### lines 160-340

160|        const end = new Date(nowTz);
161|        end.setHours(23, 59, 59, 999);
162|        const used = await tx.drawOrder.aggregate({
163|          where: {
164|            vendorId,
165|            userId: actorUserId,
166|            packId: pack.id,
167|            status: "COMPLETED",
168|            createdAt: { gte: start, lte: end },
169|          },
170|          _sum: { quantity: true },
171|        });
172|        const usedQty = used._sum.quantity ?? 0;
173|        const dailyLimit = pack.drawLimitValue ?? 1;
174|        if (usedQty + quantity > dailyLimit) {
175|          throw new Error(`Daily draw limit exceeded for this pack (${dailyLimit})`);
176|        }
177|      }
178|
179|      const packPrizes = await tx.packPrize.findMany({ where: { packId: pack.id } });
180|      const prizeLookup = new Map(packPrizes.map((prize) => [prize.id, prize]));
181|      const prizeState: PrizeState[] = packPrizes.map((prize) => ({
182|        id: prize.id,
183|        label: prize.label,
184|        weight: prize.weight,
185|        remainingStock: prize.remainingStock,
186|      }));
187|
188|      const poolSnapshotJson = {
189|        packId: pack.id,
190|        at: new Date().toISOString(),
191|        rows: prizeState
192|          .slice()
193|          .sort((a, b) => a.id.localeCompare(b.id))
194|          .map((row) => ({
195|            id: row.id,
196|            label: row.label,
197|            weight: row.weight,
198|            remainingStock: row.remainingStock,
199|          })),
200|      };
201|      const poolSnapshotHash = sha256Hex(JSON.stringify(poolSnapshotJson));
202|
203|      const serverSeed = randomBytes(32).toString("hex");
204|      const serverSeedHash = sha256Hex(serverSeed);
205|      const clientSeed = String(req.header("x-client-seed") ?? "").trim() || randomUUID();
206|      const nonceBase = randomUUID();
207|
208|      const drawOrder = await tx.drawOrder.create({
209|        data: {
210|          vendorId,
211|          userId: actorUserId,
212|          walletAccountId: wallet.id,
213|          packId: pack.id,
214|          quantity,
215|          unitPricePoints: pack.pricePoints,
216|          totalPoints: totalCost,
217|          status: "COMPLETED",
218|          requestId,
219|          idempotencyScopeKey,
220|          clientIp,
221|          userAgent,
222|          metadata: {
223|            source: "provably-fair-draw-api",
224|            fairness: {
225|              version: ALGORITHM_VERSION,
226|              serverSeedHash,
227|              clientSeed,
228|              nonceBase,
229|              poolSnapshotHash,
230|            },
231|          },
232|        },
233|      });
234|
235|      const fairnessProof = await tx.drawFairnessProof.create({
236|        data: {
237|          vendorId,
238|          drawOrderId: drawOrder.id,
239|          packId: pack.id,
240|          userId: actorUserId,
241|          algorithmVersion: ALGORITHM_VERSION,
242|          serverSeedHash,
243|          revealedServerSeed: serverSeed,
244|          clientSeed,
245|          nonceBase,
246|          quantity,
247|          poolSnapshotHash,
248|          poolSnapshotJson: poolSnapshotJson as Prisma.JsonObject,
249|        },
250|      });
251|
252|      const draws: {
253|        drawId: string;
254|        prizeId: string | null;
255|        prizeLabel: string | null;
256|        prizeImageUrl: string | null;
257|      }[] = [];
258|
259|      const selectionRows: Prisma.DrawFairnessSelectionCreateManyInput[] = [];
260|
261|      for (let i = 0; i < quantity; i += 1) {
262|        const drawSequence = i + 1;
263|        const hmacHex = hmacSha256Hex(serverSeed, `${clientSeed}:${nonceBase}:${drawSequence}`);
264|        const randomFloat = hmacToUnitFloat(hmacHex);
265|        const rowSeedHex = hmacSha256Hex(serverSeed, `${clientSeed}:row:${nonceBase}:${drawSequence}`);
266|
267|        const selectedResult = selectDeterministicPrize(prizeState, randomFloat);
268|        const selected = selectedResult.selected;
269|
270|        if (selected) {
271|          await tx.packPrize.update({
272|            where: { id: selected.id },
273|            data: { remainingStock: { decrement: 1 } },
274|          });
275|
276|          const inMemoryRow = prizeState.find((row) => row.id === selected.id);
277|          if (inMemoryRow) inMemoryRow.remainingStock -= 1;
278|        }
279|
280|        const legacyDraw = await tx.packDraw.create({
281|          data: {
282|            vendorId,
283|            packId: pack.id,
284|            prizeId: selected?.id ?? null,
285|            pointsSpent: pack.pricePoints,
286|          },
287|        });
288|
289|        await tx.drawResult.create({
290|          data: {
291|            vendorId,
292|            drawOrderId: drawOrder.id,
293|            packId: pack.id,
294|            packPrizeId: selected?.id ?? null,
295|            drawSequence,
296|            pointsSpent: pack.pricePoints,
297|            rngVersion: ALGORITHM_VERSION,
298|            rngSeedHash: sha256Hex(`${serverSeedHash}:${clientSeed}:${nonceBase}:${drawSequence}:${selected?.id ?? "none"}`),
299|            requestId,
300|          },
301|        });
302|
303|        selectionRows.push({
304|          vendorId,
305|          drawOrderId: drawOrder.id,
306|          proofId: fairnessProof.id,
307|          drawSequence,
308|          hmacHex,
309|          randomFloat: new Prisma.Decimal(randomFloat.toFixed(18)),
310|          randomWeightValue: selectedResult.randomWeightValue,
311|          totalWeightAtDraw: selectedResult.totalWeight,
312|          tierLabel: tierFromLabel(selected?.label),
313|          tierLowerBound: selectedResult.lowerBound,
314|          tierUpperBound: selectedResult.upperBound,
315|          rowSeedHex,
316|          chosenPackPrizeId: selected?.id ?? null,
317|          eligiblePrizeIds: selectedResult.eligiblePrizeIds,
318|        });
319|
320|        const prize = selected?.id ? prizeLookup.get(selected.id) : null;
321|        draws.push({
322|          drawId: legacyDraw.id,
323|          prizeId: selected?.id ?? null,
324|          prizeLabel: prize?.label ?? null,
325|          prizeImageUrl: prize?.imageUrl ?? null,
326|        });
327|      }
328|
329|      if (selectionRows.length > 0) {
330|        await tx.drawFairnessSelection.createMany({ data: selectionRows });
331|      }
332|
333|      await tx.pack.update({ where: { id: pack.id }, data: { remainingStock: { decrement: quantity } } });
334|
335|      await tx.walletAccount.update({
336|        where: { id: wallet.id },
337|        data: {
338|          balancePoints: { decrement: totalCost },
339|          version: { increment: 1 },
340|        },

### lines 480-530

480|
481|  const proof = await prisma.drawFairnessProof.findFirst({
482|    where: { drawOrderId, vendorId, userId: actorUserId },
483|    include: {
484|      selections: {
485|        orderBy: { drawSequence: "asc" },
486|      },
487|    },
488|  });
489|
490|  if (!proof) return res.status(404).json({ error: "Fairness proof not found" });
491|
492|  return res.json({
493|    proof: {
494|      drawOrderId: proof.drawOrderId,
495|      algorithmVersion: proof.algorithmVersion,
496|      serverSeedHash: proof.serverSeedHash,
497|      revealedServerSeed: proof.revealedServerSeed,
498|      clientSeed: proof.clientSeed,
499|      nonceBase: proof.nonceBase,
500|      quantity: proof.quantity,
501|      poolSnapshotHash: proof.poolSnapshotHash,
502|      createdAt: proof.createdAt,
503|      selections: proof.selections.map((row) => ({
504|        drawSequence: row.drawSequence,
505|        hmacHex: row.hmacHex,
506|        randomFloat: row.randomFloat.toString(),
507|        randomWeightValue: row.randomWeightValue,
508|        totalWeightAtDraw: row.totalWeightAtDraw,
509|        tierLabel: row.tierLabel,
510|        tierLowerBound: row.tierLowerBound,
511|        tierUpperBound: row.tierUpperBound,
512|        rowSeedHex: row.rowSeedHex,
513|        chosenPackPrizeId: row.chosenPackPrizeId,
514|      })),
515|    },
516|    howToVerify: [
517|      "1. Verify commitment: SHA256(revealedServerSeed) must equal serverSeedHash.",
518|      "2. For each sequence i, compute HMAC_SHA256(revealedServerSeed, clientSeed:nonceBase:i).",
519|      "3. Convert first 13 hex chars to integer and divide by 2^52 for randomFloat.",
520|      "4. Rebuild eligible rows from pool snapshot and remaining stock progression, then walk cumulative weights.",
521|      "5. Confirm chosenPackPrizeId and range bounds match stored selections.",
522|    ],
523|  });
524|});
525|
526|drawRouter.get("/v1/fairness-proofs", async (req: VendorRequest, res) => {
527|  const vendorId = req.vendorId;
528|  if (!vendorId) return res.status(400).json({ error: "Vendor not resolved" });
529|  const actorUserId = getRequestUserId(req);
530|  if (!actorUserId) return res.status(401).json({ error: "unauthorized" });

## packages/shared/src/index.ts

### lines 1-120

1|import { z } from "zod";
2|
3|export const createVendorSchema = z.object({
4|  name: z.string().min(2).max(80),
5|  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
6|  host: z.string().min(3).max(200),
7|});
8|
9|export const updateVendorProfileSchema = z.object({
10|  name: z.string().min(2).max(80),
11|});
12|
13|export const updateVendorPrefixSchema = z.object({
14|  slug: z
15|    .string()
16|    .min(2)
17|    .max(50)
18|    .regex(/^[a-z0-9-]+$/)
19|    .refine((value) => !value.startsWith("-") && !value.endsWith("-"), {
20|      message: "Prefix cannot start or end with hyphen",
21|    }),
22|});
23|
24|export const updateVendorBusinessSchema = z.object({
25|  businessLocation: z.string().max(200).optional().nullable(),
26|  businessContact: z.string().max(120).optional().nullable(),
27|});
28|
29|export const updateVendorReferralSchema = z.object({
30|  referralCode: z.string().min(3).max(40).regex(/^[a-z0-9-]+$/),
31|});
32|
33|export const updateVendorPlanSchema = z.object({
34|  planCode: z.enum(["BASIC", "ELITE"]),
35|});
36|
37|export const createPackSchema = z.object({
38|  title: z.string().min(2).max(120),
39|  pricePoints: z.number().int().positive(),
40|  totalStock: z.number().int().positive(),
41|  startsAt: z.string().datetime().optional(),
42|  endsAt: z.string().datetime().optional(),
43|  status: z.enum(["DRAFT", "LIVE"]).optional(),
44|  importantNotes: z.string().max(2000).optional(),
45|  drawLimitMode: z.enum(["NONE", "ONCE_PER_CUSTOMER", "DAILY_RESET"]).optional(),
46|  drawLimitValue: z.number().int().positive().optional(),
47|  drawLimitResetTimezone: z.string().max(80).optional(),
48|  isNew: z.boolean().optional().default(true),
49|  limitedLabel: z.string().min(2).max(80).optional(),
50|  tiers: z.array(
51|    z.object({
52|      name: z.string().min(1).max(40),
53|      percentage: z.number().positive().max(100).optional(),
54|      items: z.array(
55|        z.object({
56|          label: z.string().min(1).max(60),
57|          estimatedValue: z.number().int().nonnegative(),
58|          stock: z.number().int().positive(),
59|          imageUrl: z.string().url().optional(),
60|        })
61|      ).min(1).max(5000),
62|    })
63|  ).min(1).max(10).optional(),
64|  prizes: z.array(
65|    z.object({
66|      label: z.string().min(1).max(60),
67|      estimatedValue: z.number().int().nonnegative(),
68|      weight: z.number().int().positive(),
69|      stock: z.number().int().positive(),
70|      imageUrl: z.string().url().optional(),
71|    })
72|  ).min(1).max(5000).optional(),
73|});
74|
75|export const updatePackSchema = createPackSchema.partial().extend({
76|  title: z.string().min(2).max(120).optional(),
77|});
78|
79|export const drawSchema = z.object({
80|  packId: z.string().cuid(),
81|  quantity: z.number().int().min(1).max(5000).default(1),
82|});
83|
84|export const createBannerSchema = z.object({
85|  title: z.string().min(2).max(80),
86|  imageUrl: z.string().url(),
87|  targetUrl: z.string().url().optional(),
88|  sortOrder: z.number().int().min(0).max(999).optional().default(0),
89|  isActive: z.boolean().optional().default(true),
90|});
91|
92|export const updateVendorLimitsSchema = z.object({
93|  maxPackItems: z.number().int().min(1).max(5000).optional(),
94|  maxDrawQuantity: z.number().int().min(1).max(5000).optional(),
95|});
96|
97|export type CreateVendorInput = z.infer<typeof createVendorSchema>;
98|export type UpdateVendorProfileInput = z.infer<typeof updateVendorProfileSchema>;
99|export type UpdateVendorPrefixInput = z.infer<typeof updateVendorPrefixSchema>;
100|export type UpdateVendorBusinessInput = z.infer<typeof updateVendorBusinessSchema>;
101|export type UpdateVendorReferralInput = z.infer<typeof updateVendorReferralSchema>;
102|export type UpdateVendorPlanInput = z.infer<typeof updateVendorPlanSchema>;
103|export type CreatePackInput = z.infer<typeof createPackSchema>;
104|export type UpdatePackInput = z.infer<typeof updatePackSchema>;
105|export type DrawInput = z.infer<typeof drawSchema>;
106|export type CreateBannerInput = z.infer<typeof createBannerSchema>;
107|export type UpdateVendorLimitsInput = z.infer<typeof updateVendorLimitsSchema>;

## apps/web/app/vendor/page.tsx

### lines 1-220

1|"use client";
2|
3|import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
4|import { usePathname, useRouter } from "next/navigation";
5|import { useBackForwardRefresh } from "../../lib/use-back-forward-refresh";
6|import QRCode from "qrcode";
7|
8|type Vendor = {
9|  id: string;
10|  name: string;
11|  slug: string;
12|  host: string;
13|  isActive: boolean;
14|  referralCode?: string | null;
15|  businessLocation?: string | null;
16|  businessContact?: string | null;
17|};
18|
19|type VendorLimits = {
20|  planCode: "BASIC" | "ELITE";
21|  maxPackItems: number;
22|  maxPackTiers: number;
23|  maxDrawQuantity: number;
24|};
25|
26|type EarningsSummary = {
27|  totalRevenuePoints: number;
28|  totalRevenueCurrency: number;
29|  vendorSpentPoints: number;
30|  netPoints: number;
31|  currencyCode: string;
32|};
33|
34|type PackEarning = {
35|  packId: string;
36|  packTitle: string;
37|  drawOrders: number;
38|  totalDrawQuantity: number;
39|  totalPoints: number;
40|};
41|
42|type ReferralCustomer = {
43|  id: string;
44|  email: string;
45|  displayName?: string | null;
46|  createdAt: string;
47|  referredAt: string;
48|  referralCode: string;
49|};
50|
51|type VendorQr = {
52|  id: string;
53|  token: string;
54|  points: number;
55|  status: "ACTIVE" | "REDEEMED" | "EXPIRED" | "CANCELLED";
56|  expiresAt: string;
57|  createdAt: string;
58|};
59|
60|type Banner = {
61|  id: string;
62|  title: string;
63|  imageUrl: string;
64|  targetUrl?: string | null;
65|  sortOrder: number;
66|  isActive: boolean;
67|};
68|
69|type Pack = {
70|  id: string;
71|  title: string;
72|  pricePoints: number;
73|  totalStock: number;
74|  remainingStock: number;
75|  status: "DRAFT" | "LIVE" | "ARCHIVED";
76|  importantNotes?: string | null;
77|  drawLimitMode: "NONE" | "ONCE_PER_CUSTOMER" | "DAILY_RESET";
78|  drawLimitValue?: number | null;
79|  drawLimitResetTimezone?: string | null;
80|  startsAt?: string | null;
81|  endsAt?: string | null;
82|  createdAt: string;
83|  prizes: Array<{
84|    id: string;
85|    label: string;
86|    imageUrl?: string | null;
87|    estimatedValue: number;
88|    stock: number;
89|    remainingStock: number;
90|  }>;
91|};
92|
93|type ItemDraft = {
94|  label: string;
95|  estimatedValue: string;
96|  stock: string;
97|  imageUrl: string;
98|};
99|
100|type TierDraft = {
101|  name: string;
102|  percentage: string;
103|  items: ItemDraft[];
104|};
105|
106|type CatalogSuggestion = {
107|  id: string;
108|  source: string;
109|  sourceItemId: string;
110|  itemType: "CARD" | "SEALED_PRODUCT";
111|  game: string;
112|  language: string;
113|  name: string;
114|  setId?: string | null;
115|  setName?: string | null;
116|  cardNumber?: string | null;
117|  rarity?: string | null;
118|  imageThumbUrl?: string | null;
119|  imageLargeUrl?: string | null;
120|  imageBaseUrl?: string | null;
121|};
122|
123|const DEFAULT_CARD = "https://archives.bulbagarden.net/media/upload/1/17/Cardback.jpg";
124|const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
125|const configuredVendorHost = process.env.NEXT_PUBLIC_TENANT_HOST ?? "";
126|const clientPageHeader = { "x-client-page": "/vendor" };
127|type ActiveTab = "BUSINESS" | "PACKS";
128|
129|function parseTabValue(tab: string | null): ActiveTab {
130|  if (tab === "pack-studio") return "PACKS";
131|  return "BUSINESS";
132|}
133|
134|function toTabValue(tab: ActiveTab): "business" | "pack-studio" {
135|  return tab === "PACKS" ? "pack-studio" : "business";
136|}
137|
138|function createItem(): ItemDraft {
139|  return {
140|    label: "",
141|    estimatedValue: "50",
142|    stock: "1",
143|    imageUrl: DEFAULT_CARD,
144|  };
145|}
146|
147|function createTier(index: number): TierDraft {
148|  return {
149|    name: `${String.fromCharCode(65 + index)} Tier`,
150|    percentage: "",
151|    items: [createItem()],
152|  };
153|}
154|
155|function toLocalInputValue(iso?: string | null) {
156|  if (!iso) return "";
157|  const date = new Date(iso);
158|  const offset = date.getTimezoneOffset();
159|  const local = new Date(date.getTime() - offset * 60000);
160|  return local.toISOString().slice(0, 16);
161|}
162|
163|export default function VendorPage() {
164|  const router = useRouter();
165|  const pathname = usePathname();
166|  const runtimeVendorHost = useMemo(() => {
167|    if (typeof window !== "undefined" && window.location?.host) {
168|      return window.location.host.toLowerCase();
169|    }
170|    return configuredVendorHost || "demo.localhost";
171|  }, []);
172|  const vendorBaseDomain = useMemo(() => {
173|    const host = configuredVendorHost || runtimeVendorHost;
174|    return host.replace(/^[^.]+\./, "");
175|  }, [runtimeVendorHost]);
176|  const headers = useMemo(() => ({ "x-vendor-host": runtimeVendorHost, ...clientPageHeader }), [runtimeVendorHost]);
177|  const authHeaders = useCallback(() => {
178|    return {
179|      ...headers,
180|    };
181|  }, [headers]);
182|
183|  const [vendor, setVendor] = useState<Vendor | null>(null);
184|  const [limits, setLimits] = useState<VendorLimits>({ planCode: "BASIC", maxPackItems: 50, maxPackTiers: 5, maxDrawQuantity: 100 });
185|  const [summary, setSummary] = useState<EarningsSummary | null>(null);
186|  const [packEarnings, setPackEarnings] = useState<PackEarning[]>([]);
187|  const [referrals, setReferrals] = useState<ReferralCustomer[]>([]);
188|  const [qrs, setQrs] = useState<VendorQr[]>([]);
189|  const [banners, setBanners] = useState<Banner[]>([]);
190|  const [packs, setPacks] = useState<Pack[]>([]);
191|
192|  const [vendorName, setVendorName] = useState("");
193|  const [vendorSlug, setVendorSlug] = useState("");
194|  const [businessLocation, setBusinessLocation] = useState("");
195|  const [businessContact, setBusinessContact] = useState("");
196|  const [referralCode, setReferralCode] = useState("");
197|
198|  const [bannerTitle, setBannerTitle] = useState("");
199|  const [bannerImageUrl, setBannerImageUrl] = useState("");
200|  const [bannerTargetUrl, setBannerTargetUrl] = useState("");
201|
202|  const [editingPackId, setEditingPackId] = useState<string | null>(null);
203|  const [packTitle, setPackTitle] = useState("");
204|  const [startsAt, setStartsAt] = useState("");
205|  const [endsAt, setEndsAt] = useState("");
206|  const [pricePoints, setPricePoints] = useState("100");
207|  const [totalStock, setTotalStock] = useState("100");
208|  const [status, setStatus] = useState<"DRAFT" | "LIVE">("DRAFT");
209|  const [isNew, setIsNew] = useState(true);
210|  const [limitedLabel, setLimitedLabel] = useState("");
211|  const [importantNotes, setImportantNotes] = useState("");
212|  const [drawLimitMode, setDrawLimitMode] = useState<"NONE" | "ONCE_PER_CUSTOMER" | "DAILY_RESET">("NONE");
213|  const [drawLimitValue, setDrawLimitValue] = useState("1");
214|  const [drawLimitResetTimezone, setDrawLimitResetTimezone] = useState("Asia/Singapore");
215|  const [tiers, setTiers] = useState<TierDraft[]>([createTier(0)]);
216|  const [qrPoints, setQrPoints] = useState("100");
217|  const [qrExpiryMinutes, setQrExpiryMinutes] = useState("15");
218|  const [activeQr, setActiveQr] = useState<VendorQr | null>(null);
219|  const [activeQrDataUrl, setActiveQrDataUrl] = useState<string | null>(null);
220|  const [itemSearchTarget, setItemSearchTarget] = useState<{ tierIndex: number; itemIndex: number } | null>(null);

### lines 220-520

220|  const [itemSearchTarget, setItemSearchTarget] = useState<{ tierIndex: number; itemIndex: number } | null>(null);
221|  const [itemSearchQuery, setItemSearchQuery] = useState("");
222|  const [itemSuggestions, setItemSuggestions] = useState<CatalogSuggestion[]>([]);
223|  const [itemSuggestLoading, setItemSuggestLoading] = useState(false);
224|
225|  const [loading, setLoading] = useState(true);
226|  const [saving, setSaving] = useState(false);
227|  const [error, setError] = useState<string | null>(null);
228|  const [success, setSuccess] = useState<string | null>(null);
229|  const [activeTab, setActiveTab] = useState<ActiveTab>("BUSINESS");
230|
231|  const totalDraftItems = tiers.reduce((sum, tier) => sum + tier.items.length, 0);
232|
233|  async function resolveVendorHomeHost() {
234|    const response = await fetch(`${apiBase}/v1/auth/vendor-home`, {
235|      headers: clientPageHeader,
236|      credentials: "include",
237|      cache: "no-store",
238|    });
239|    const payload = await response.json().catch(() => ({}));
240|    if (!response.ok) return null;
241|    const host = String(payload.vendorHost ?? "").trim().toLowerCase();
242|    return host || null;
243|  }
244|
245|  const loadAll = useCallback(async () => {
246|    setLoading(true);
247|    setError(null);
248|
249|    try {
250|      const vendorRes = await fetch(`${apiBase}/v1/vendor/current`, { headers: authHeaders(), credentials: "include", cache: "no-store" });
251|      if (!vendorRes.ok) {
252|        if (vendorRes.status === 400) {
253|          const membershipHost = await resolveVendorHomeHost();
254|          const currentHost = window.location.host.toLowerCase();
255|          if (membershipHost && membershipHost !== currentHost) {
256|            window.location.href = `${window.location.protocol}//${membershipHost}/vendor`;
257|            return;
258|          }
259|          throw new Error("Vendor context not resolved for this host. Please use your vendor subdomain.");
260|        }
261|        if (vendorRes.status === 401) {
262|          throw new Error("Please login with your vendor account.");
263|        }
264|        throw new Error("Failed to resolve vendor context.");
265|      }
266|
267|      const vendorJson = await vendorRes.json();
268|      const [limitsRes, summaryRes, packEarningsRes, referralsRes, bannersRes, packsRes, qrRes] = await Promise.all([
269|        fetch(`${apiBase}/v1/vendor/limits`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
270|        fetch(`${apiBase}/v1/vendor/earnings/summary`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
271|        fetch(`${apiBase}/v1/vendor/earnings/packs`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
272|        fetch(`${apiBase}/v1/vendor/referrals`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
273|        fetch(`${apiBase}/v1/vendor/banners`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
274|        fetch(`${apiBase}/v1/vendor/packs`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
275|        fetch(`${apiBase}/v1/vendor/points/qr`, { headers: authHeaders(), credentials: "include", cache: "no-store" }),
276|      ]);
277|
278|      if (!limitsRes.ok || !summaryRes.ok || !packEarningsRes.ok || !bannersRes.ok || !packsRes.ok) {
279|        throw new Error("Failed to load vendor dashboard data");
280|      }
281|
282|      const limitsJson = await limitsRes.json();
283|      const summaryJson = await summaryRes.json();
284|      const packEarningsJson = await packEarningsRes.json();
285|      const referralsJson = await referralsRes.json();
286|      const qrJson = qrRes.ok ? await qrRes.json() : { qrs: [] };
287|      const bannersJson = await bannersRes.json();
288|      const packsJson = await packsRes.json();
289|
290|      const v = vendorJson.vendor ?? null;
291|      setVendor(v);
292|      setVendorName(v?.name ?? "");
293|      setVendorSlug(v?.slug ?? "");
294|      setBusinessLocation(v?.businessLocation ?? "");
295|      setBusinessContact(v?.businessContact ?? "");
296|      setReferralCode(v?.referralCode ?? "");
297|
298|      setLimits(limitsJson.limits ?? { planCode: "BASIC", maxPackItems: 50, maxPackTiers: 5, maxDrawQuantity: 100 });
299|      setSummary(summaryJson.summary ?? null);
300|      setPackEarnings(packEarningsJson.items ?? []);
301|      setReferrals(referralsJson.customers ?? []);
302|      setQrs(qrJson.qrs ?? []);
303|      setBanners(bannersJson.banners ?? []);
304|      setPacks(packsJson.packs ?? []);
305|    } catch (err) {
306|      setError(err instanceof Error ? err.message : "Failed to load data");
307|    } finally {
308|      setLoading(false);
309|    }
310|  }, [authHeaders]);
311|
312|  useEffect(() => {
313|    void loadAll();
314|  }, [loadAll]);
315|
316|  useBackForwardRefresh(loadAll, { cooldownMs: 20000 });
317|
318|  useEffect(() => {
319|    const target = itemSearchTarget;
320|    const query = itemSearchQuery.trim();
321|    if (!target || query.length < 2) {
322|      setItemSuggestions([]);
323|      setItemSuggestLoading(false);
324|      return;
325|    }
326|
327|    const timer = window.setTimeout(() => {
328|      setItemSuggestLoading(true);
329|      const url = new URL(`${apiBase}/v1/catalog/search`);
330|      url.searchParams.set("q", query);
331|      url.searchParams.set("limit", "8");
332|      url.searchParams.set("type", "card");
333|
334|      fetch(url.toString(), {
335|        headers: authHeaders(),
336|        credentials: "include",
337|        cache: "no-store",
338|      })
339|        .then(async (res) => {
340|          const payload = await res.json().catch(() => ({}));
341|          if (!res.ok) throw new Error(payload?.error ?? "Failed to search cards");
342|          setItemSuggestions((payload.items ?? []) as CatalogSuggestion[]);
343|        })
344|        .catch(() => {
345|          setItemSuggestions([]);
346|        })
347|        .finally(() => {
348|          setItemSuggestLoading(false);
349|        });
350|    }, 300);
351|
352|    return () => window.clearTimeout(timer);
353|  }, [authHeaders, itemSearchQuery, itemSearchTarget]);
354|
355|  useEffect(() => {
356|    if (typeof window === "undefined") return;
357|    const params = new URLSearchParams(window.location.search);
358|    setActiveTab(parseTabValue(params.get("tab")));
359|  }, []);
360|
361|  function setActiveTabInUrl(tab: ActiveTab) {
362|    setActiveTab(tab);
363|    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
364|    params.set("tab", toTabValue(tab));
365|    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
366|  }
367|
368|  async function bootstrapOwner() {
369|    setSaving(true);
370|    setError(null);
371|    setSuccess(null);
372|    try {
373|      const res = await fetch(`${apiBase}/v1/vendor/bootstrap-owner`, {
374|        method: "POST",
375|        headers: authHeaders(),
376|        credentials: "include",
377|      });
378|      const body = await res.json().catch(() => null);
379|      if (!res.ok) throw new Error(body?.error ?? "Failed to bootstrap vendor owner");
380|      setSuccess(body?.membership?.bootstrapped ? "Vendor owner access granted." : "Vendor membership already exists.");
381|      await loadAll();
382|    } catch (err) {
383|      setError(err instanceof Error ? err.message : "Failed to bootstrap owner");
384|    } finally {
385|      setSaving(false);
386|    }
387|  }
388|
389|  async function saveVendorProfile(event: FormEvent) {
390|    event.preventDefault();
391|    setSaving(true);
392|    setError(null);
393|    setSuccess(null);
394|
395|    try {
396|      const profileRes = await fetch(`${apiBase}/v1/vendor/profile`, {
397|        method: "PATCH",
398|        headers: { ...authHeaders(), "content-type": "application/json" },
399|        credentials: "include",
400|        body: JSON.stringify({ name: vendorName }),
401|      });
402|      if (!profileRes.ok) {
403|        const body = await profileRes.json().catch(() => null);
404|        throw new Error(body?.error ?? "Failed to update vendor profile name");
405|      }
406|
407|      const businessRes = await fetch(`${apiBase}/v1/vendor/business`, {
408|        method: "PATCH",
409|        headers: { ...authHeaders(), "content-type": "application/json" },
410|        credentials: "include",
411|        body: JSON.stringify({ businessLocation, businessContact }),
412|      });
413|      if (!businessRes.ok) {
414|        const body = await businessRes.json().catch(() => null);
415|        throw new Error(body?.error ?? "Failed to update business information");
416|      }
417|
418|      const trimmedReferral = referralCode.trim();
419|      if (trimmedReferral.length > 0) {
420|        const referralRes = await fetch(`${apiBase}/v1/vendor/referral`, {
421|          method: "PATCH",
422|          headers: { ...authHeaders(), "content-type": "application/json" },
423|          credentials: "include",
424|          body: JSON.stringify({ referralCode: trimmedReferral }),
425|        });
426|        if (!referralRes.ok) {
427|          const body = await referralRes.json().catch(() => null);
428|          throw new Error(body?.error ?? "Failed to update referral code");
429|        }
430|      }
431|
432|      setSuccess("Vendor profile updated.");
433|      await loadAll();
434|    } catch (err) {
435|      setError(err instanceof Error ? err.message : "Failed to update vendor profile");
436|    } finally {
437|      setSaving(false);
438|    }
439|  }
440|
441|  async function saveVendorPrefix(event: FormEvent) {
442|    event.preventDefault();
443|    setSaving(true);
444|    setError(null);
445|    setSuccess(null);
446|
447|    try {
448|      const res = await fetch(`${apiBase}/v1/vendor/prefix`, {
449|        method: "PATCH",
450|        headers: { ...authHeaders(), "content-type": "application/json" },
451|        credentials: "include",
452|        body: JSON.stringify({ slug: vendorSlug.trim().toLowerCase() }),
453|      });
454|      const body = await res.json().catch(() => null);
455|      if (!res.ok) throw new Error(body?.error ?? "Failed to update vendor prefix");
456|
457|      setSuccess(body?.message ?? "Vendor prefix updated.");
458|      await loadAll();
459|    } catch (err) {
460|      setError(err instanceof Error ? err.message : "Failed to update vendor prefix");
461|    } finally {
462|      setSaving(false);
463|    }
464|  }
465|
466|  async function switchPlan(nextPlanCode: "BASIC" | "ELITE") {
467|    setSaving(true);
468|    setError(null);
469|    setSuccess(null);
470|
471|    try {
472|      const res = await fetch(`${apiBase}/v1/vendor/plan`, {
473|        method: "PATCH",
474|        headers: { ...authHeaders(), "content-type": "application/json" },
475|        credentials: "include",
476|        body: JSON.stringify({ planCode: nextPlanCode }),
477|      });
478|      if (!res.ok) {
479|        const body = await res.json().catch(() => null);
480|        throw new Error(body?.error ?? "Failed to update plan");
481|      }
482|      setSuccess(`Plan updated to ${nextPlanCode}.`);
483|      await loadAll();
484|    } catch (err) {
485|      setError(err instanceof Error ? err.message : "Failed to update plan");
486|    } finally {
487|      setSaving(false);
488|    }
489|  }
490|
491|  async function generateQr(event: FormEvent) {
492|    event.preventDefault();
493|    setSaving(true);
494|    setError(null);
495|    setSuccess(null);
496|    try {
497|      const res = await fetch(`${apiBase}/v1/vendor/points/qr`, {
498|        method: "POST",
499|        headers: {
500|          ...authHeaders(),
501|          "content-type": "application/json",
502|        },
503|        credentials: "include",
504|        body: JSON.stringify({
505|          points: Number(qrPoints),
506|          expiresInMinutes: Number(qrExpiryMinutes),
507|        }),
508|      });
509|      if (!res.ok) {
510|        const body = await res.json().catch(() => null);
511|        throw new Error(body?.error ?? "Failed to create QR");
512|      }
513|      setSuccess("QR generated.");
514|      await loadAll();
515|    } catch (err) {
516|      setError(err instanceof Error ? err.message : "Failed to generate QR");
517|    } finally {
518|      setSaving(false);
519|    }
520|  }

### lines 520-820

520|  }
521|
522|  useEffect(() => {
523|    if (!activeQr?.token) {
524|      setActiveQrDataUrl(null);
525|      return;
526|    }
527|    let mounted = true;
528|    QRCode.toDataURL(activeQr.token, {
529|      width: 300,
530|      margin: 1,
531|      errorCorrectionLevel: "M",
532|      color: {
533|        dark: "#0f172a",
534|        light: "#ffffff",
535|      },
536|    })
537|      .then((url) => {
538|        if (mounted) setActiveQrDataUrl(url);
539|      })
540|      .catch(() => {
541|        if (mounted) setActiveQrDataUrl(null);
542|      });
543|    return () => {
544|      mounted = false;
545|    };
546|  }, [activeQr]);
547|
548|  async function addBanner(event: FormEvent) {
549|    event.preventDefault();
550|    setSaving(true);
551|    setError(null);
552|    setSuccess(null);
553|
554|    try {
555|      const payload: Record<string, unknown> = {
556|        title: bannerTitle,
557|        imageUrl: bannerImageUrl,
558|      };
559|
560|      if (bannerTargetUrl.trim()) payload.targetUrl = bannerTargetUrl.trim();
561|
562|      const res = await fetch(`${apiBase}/v1/vendor/banners`, {
563|        method: "POST",
564|        headers: { ...authHeaders(), "content-type": "application/json" },
565|        credentials: "include",
566|        body: JSON.stringify(payload),
567|      });
568|      if (!res.ok) throw new Error("Failed to add banner");
569|
570|      setBannerTitle("");
571|      setBannerImageUrl("");
572|      setBannerTargetUrl("");
573|      setSuccess("Banner added.");
574|      await loadAll();
575|    } catch (err) {
576|      setError(err instanceof Error ? err.message : "Failed to add banner");
577|    } finally {
578|      setSaving(false);
579|    }
580|  }
581|
582|  async function deleteBanner(id: string) {
583|    setSaving(true);
584|    setError(null);
585|    setSuccess(null);
586|
587|    try {
588|      const res = await fetch(`${apiBase}/v1/vendor/banners/${id}`, {
589|        method: "DELETE",
590|        headers: authHeaders(),
591|        credentials: "include",
592|      });
593|      if (!res.ok) throw new Error("Failed to delete banner");
594|      setSuccess("Banner removed.");
595|      await loadAll();
596|    } catch (err) {
597|      setError(err instanceof Error ? err.message : "Failed to delete banner");
598|    } finally {
599|      setSaving(false);
600|    }
601|  }
602|
603|  function updateTier(index: number, field: keyof Omit<TierDraft, "items">, value: string) {
604|    setTiers((prev) => prev.map((tier, i) => (i === index ? { ...tier, [field]: value } : tier)));
605|  }
606|
607|  function updateItem(tierIndex: number, itemIndex: number, field: keyof ItemDraft, value: string) {
608|    setTiers((prev) =>
609|      prev.map((tier, i) => {
610|        if (i !== tierIndex) return tier;
611|        const items = tier.items.map((item, ii) => (ii === itemIndex ? { ...item, [field]: value } : item));
612|        return { ...tier, items };
613|      })
614|    );
615|  }
616|
617|  function applyCatalogSuggestion(tierIndex: number, itemIndex: number, suggestion: CatalogSuggestion) {
618|    const nextLabel = [suggestion.name, suggestion.cardNumber ? `#${suggestion.cardNumber}` : ""].filter(Boolean).join(" ");
619|    setTiers((prev) =>
620|      prev.map((tier, i) => {
621|        if (i !== tierIndex) return tier;
622|        const items = tier.items.map((item, ii) => {
623|          if (ii !== itemIndex) return item;
624|          return {
625|            ...item,
626|            label: nextLabel || suggestion.name,
627|            imageUrl: suggestion.imageLargeUrl || suggestion.imageThumbUrl || suggestion.imageBaseUrl || item.imageUrl || DEFAULT_CARD,
628|          };
629|        });
630|        return { ...tier, items };
631|      })
632|    );
633|    setItemSearchTarget(null);
634|    setItemSearchQuery("");
635|    setItemSuggestions([]);
636|  }
637|
638|  function addTier() {
639|    setTiers((prev) => {
640|      if (prev.length >= limits.maxPackTiers) return prev;
641|      return [...prev, createTier(prev.length)];
642|    });
643|  }
644|
645|  function removeTier(tierIndex: number) {
646|    if (itemSearchTarget?.tierIndex === tierIndex) {
647|      setItemSearchTarget(null);
648|      setItemSearchQuery("");
649|      setItemSuggestions([]);
650|    }
651|    setTiers((prev) => {
652|      if (prev.length <= 1) return prev;
653|      return prev.filter((_, i) => i !== tierIndex);
654|    });
655|  }
656|
657|  function addItem(tierIndex: number) {
658|    setTiers((prev) =>
659|      prev.map((tier, i) => {
660|        if (i !== tierIndex) return tier;
661|        if (totalDraftItems >= limits.maxPackItems) return tier;
662|        return { ...tier, items: [...tier.items, createItem()] };
663|      })
664|    );
665|  }
666|
667|  function removeItem(tierIndex: number, itemIndex: number) {
668|    if (itemSearchTarget?.tierIndex === tierIndex && itemSearchTarget?.itemIndex === itemIndex) {
669|      setItemSearchTarget(null);
670|      setItemSearchQuery("");
671|      setItemSuggestions([]);
672|    }
673|    setTiers((prev) =>
674|      prev.map((tier, i) => {
675|        if (i !== tierIndex) return tier;
676|        if (tier.items.length <= 1) return tier;
677|        return { ...tier, items: tier.items.filter((_, ii) => ii !== itemIndex) };
678|      })
679|    );
680|  }
681|
682|  function toIsoDateTime(localValue: string) {
683|    if (!localValue) return undefined;
684|    const date = new Date(localValue);
685|    if (Number.isNaN(date.getTime())) return undefined;
686|    return date.toISOString();
687|  }
688|
689|  function resetPackForm() {
690|    setEditingPackId(null);
691|    setPackTitle("");
692|    setStartsAt("");
693|    setEndsAt("");
694|    setPricePoints("100");
695|    setTotalStock("100");
696|    setStatus("DRAFT");
697|    setIsNew(true);
698|    setLimitedLabel("");
699|    setImportantNotes("");
700|    setDrawLimitMode("NONE");
701|    setDrawLimitValue("1");
702|    setDrawLimitResetTimezone("Asia/Singapore");
703|    setTiers([createTier(0)]);
704|  }
705|
706|  function editPack(pack: Pack) {
707|    setEditingPackId(pack.id);
708|    setPackTitle(pack.title);
709|    setPricePoints(String(pack.pricePoints));
710|    setTotalStock(String(pack.totalStock));
711|    setStartsAt(toLocalInputValue(pack.startsAt));
712|    setEndsAt(toLocalInputValue(pack.endsAt));
713|    setStatus(pack.status === "ARCHIVED" ? "DRAFT" : pack.status);
714|    setIsNew(Boolean((pack as any).isNew ?? true));
715|    setLimitedLabel((pack as any).limitedLabel ?? "");
716|    setImportantNotes(pack.importantNotes ?? "");
717|    setDrawLimitMode(pack.drawLimitMode ?? "NONE");
718|    setDrawLimitValue(String(pack.drawLimitValue ?? 1));
719|    setDrawLimitResetTimezone(pack.drawLimitResetTimezone ?? "Asia/Singapore");
720|
721|    setTiers([
722|      {
723|        name: "A Tier",
724|        percentage: "",
725|        items: pack.prizes.map((prize) => ({
726|          label: prize.label,
727|          estimatedValue: String(prize.estimatedValue),
728|          stock: String(prize.stock),
729|          imageUrl: prize.imageUrl ?? DEFAULT_CARD,
730|        })),
731|      },
732|    ]);
733|  }
734|
735|  async function submitPack(event: FormEvent) {
736|    event.preventDefault();
737|    setSaving(true);
738|    setError(null);
739|    setSuccess(null);
740|
741|    try {
742|      if (tiers.length > limits.maxPackTiers) {
743|        throw new Error(`Tier count exceeds plan limit (${limits.maxPackTiers}).`);
744|      }
745|      if (totalDraftItems > limits.maxPackItems) {
746|        throw new Error(`Item count exceeds plan limit (${limits.maxPackItems}).`);
747|      }
748|
749|      const payload = {
750|        title: packTitle,
751|        pricePoints: Number(pricePoints),
752|        totalStock: Number(totalStock),
753|        startsAt: toIsoDateTime(startsAt),
754|        endsAt: toIsoDateTime(endsAt),
755|        status,
756|        isNew,
757|        limitedLabel: limitedLabel.trim() ? limitedLabel.trim() : undefined,
758|        importantNotes: importantNotes.trim() ? importantNotes.trim() : undefined,
759|        drawLimitMode,
760|        drawLimitValue: drawLimitMode === "DAILY_RESET" ? Number(drawLimitValue) : undefined,
761|        drawLimitResetTimezone,
762|        tiers: tiers.map((tier) => ({
763|          name: tier.name,
764|          percentage: tier.percentage.trim() ? Number(tier.percentage) : undefined,
765|          items: tier.items.map((item) => ({
766|            label: item.label,
767|            estimatedValue: Number(item.estimatedValue),
768|            stock: Number(item.stock),
769|            imageUrl: item.imageUrl.trim() ? item.imageUrl.trim() : undefined,
770|          })),
771|        })),
772|      };
773|
774|      const endpoint = editingPackId ? `${apiBase}/v1/vendor/packs/${editingPackId}` : `${apiBase}/v1/vendor/packs`;
775|      const method = editingPackId ? "PATCH" : "POST";
776|
777|      const res = await fetch(endpoint, {
778|        method,
779|        headers: { ...authHeaders(), "content-type": "application/json" },
780|        credentials: "include",
781|        body: JSON.stringify(payload),
782|      });
783|
784|      if (!res.ok) {
785|        const body = await res.json().catch(() => null);
786|        throw new Error(body?.error ?? "Failed to save pack");
787|      }
788|
789|      setSuccess(editingPackId ? "Pack updated successfully." : "Pack created successfully.");
790|      resetPackForm();
791|      await loadAll();
792|    } catch (err) {
793|      setError(err instanceof Error ? err.message : "Failed to save pack");
794|    } finally {
795|      setSaving(false);
796|    }
797|  }
798|
799|  async function archivePack(packId: string) {
800|    setSaving(true);
801|    setError(null);
802|    setSuccess(null);
803|    try {
804|      const res = await fetch(`${apiBase}/v1/vendor/packs/${packId}/archive`, {
805|        method: "PATCH",
806|        headers: authHeaders(),
807|        credentials: "include",
808|      });
809|      if (!res.ok) throw new Error("Failed to archive pack");
810|      setSuccess("Pack archived.");
811|      await loadAll();
812|    } catch (err) {
813|      setError(err instanceof Error ? err.message : "Failed to archive pack");
814|    } finally {
815|      setSaving(false);
816|    }
817|  }
818|
819|  async function deletePack(packId: string) {
820|    setSaving(true);

### lines 820-1100

820|    setSaving(true);
821|    setError(null);
822|    setSuccess(null);
823|    try {
824|      const res = await fetch(`${apiBase}/v1/vendor/packs/${packId}`, {
825|        method: "DELETE",
826|        headers: authHeaders(),
827|        credentials: "include",
828|      });
829|      const body = await res.json().catch(() => null);
830|      if (!res.ok) throw new Error(body?.error ?? "Failed to delete pack");
831|      if (body?.mode === "retired") {
832|        setSuccess(body?.message ?? "Pack has history and was archived/hidden instead of hard deleted.");
833|      } else {
834|        setSuccess("Pack deleted.");
835|      }
836|      await loadAll();
837|    } catch (err) {
838|      setError(err instanceof Error ? err.message : "Failed to delete pack");
839|    } finally {
840|      setSaving(false);
841|    }
842|  }
843|
844|  return (
845|    <main className="container">
846|      <header className="site-header">
847|        <div className="brand-text">
848|          <strong>Vendor Dashboard</strong>
849|          <span>{vendor?.name ?? "-"} ({vendor?.host ?? runtimeVendorHost})</span>
850|        </div>
851|        <div className="actions">
852|          <button type="button" className="sort-pill" onClick={() => void bootstrapOwner()} disabled={saving}>Bootstrap Owner Access</button>
853|          <a className="sort-pill" href="/">Back to Homepage</a>
854|        </div>
855|      </header>
856|
857|      {error ? <p className="error">{error}</p> : null}
858|      {success ? <p className="badge">{success}</p> : null}
859|
860|      <section className="card">
861|        <div className="actions">
862|          <button
863|            type="button"
864|            className={`sort-pill ${activeTab === "BUSINESS" ? "active" : ""}`}
865|            onClick={() => setActiveTabInUrl("BUSINESS")}
866|          >
867|            Business
868|          </button>
869|          <button
870|            type="button"
871|            className={`sort-pill ${activeTab === "PACKS" ? "active" : ""}`}
872|            onClick={() => setActiveTabInUrl("PACKS")}
873|          >
874|            Pack Studio
875|          </button>
876|        </div>
877|      </section>
878|
879|      {activeTab === "BUSINESS" ? (
880|        <>
881|          <section className="card" style={{ marginTop: 12 }}>
882|            <h2>Plan & Earnings</h2>
883|            <p className="muted tiny">Current plan: <strong>{limits.planCode}</strong> | Pack tiers max: {limits.maxPackTiers} | Pack items max: {limits.maxPackItems}</p>
884|            <div className="actions">
885|              <button type="button" className="sort-pill" disabled={saving || limits.planCode === "BASIC"} onClick={() => void switchPlan("BASIC")}>Switch to BASIC</button>
886|              <button type="button" className="sort-pill" disabled={saving || limits.planCode === "ELITE"} onClick={() => void switchPlan("ELITE")}>Switch to ELITE</button>
887|            </div>
888|            <div className="stats-grid">
889|              <div className="stat"><div className="stat-label">Total Revenue Points</div><div className="stat-value">{summary?.totalRevenuePoints?.toLocaleString() ?? "0"}</div></div>
890|              <div className="stat"><div className="stat-label">Net Points</div><div className="stat-value">{summary?.netPoints?.toLocaleString() ?? "0"}</div></div>
891|              <div className="stat"><div className="stat-label">Currency Revenue</div><div className="stat-value">{summary ? `${summary.totalRevenueCurrency.toFixed(2)} ${summary.currencyCode}` : "0"}</div></div>
892|            </div>
893|          </section>
894|
895|          <section className="card" style={{ marginTop: 12 }}>
896|            <h2>Vendor Profile / Business / Referral</h2>
897|            <form className="vendor-form" onSubmit={saveVendorProfile}>
898|              <label className="muted tiny">
899|                Vendor name
900|                <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Vendor name" required minLength={2} maxLength={80} />
901|              </label>
902|              <label className="muted tiny">
903|                Business location
904|                <input value={businessLocation} onChange={(e) => setBusinessLocation(e.target.value)} placeholder="Business location" />
905|              </label>
906|              <label className="muted tiny">
907|                Business contact
908|                <input value={businessContact} onChange={(e) => setBusinessContact(e.target.value)} placeholder="Business contact" />
909|              </label>
910|              <label className="muted tiny">
911|                Referral code URL slug
912|                <input value={referralCode} onChange={(e) => setReferralCode(e.target.value)} placeholder="Referral code URL slug" required minLength={3} maxLength={40} />
913|              </label>
914|              <button type="submit" className="draw-button" disabled={saving || loading}>Save Vendor Info</button>
915|            </form>
916|            <form className="vendor-form" onSubmit={saveVendorPrefix}>
917|              <label className="muted tiny">
918|                Vendor URL prefix (slug)
919|                <input
920|                  value={vendorSlug}
921|                  onChange={(e) => setVendorSlug(e.target.value)}
922|                  placeholder="Vendor URL prefix (slug)"
923|                  required
924|                  minLength={2}
925|                  maxLength={50}
926|                  pattern="^[a-z0-9-]+$"
927|                />
928|              </label>
929|              <p className="muted tiny">New vendor URL: <code>https://{vendorSlug || "your-prefix"}.{vendorBaseDomain}</code></p>
930|              <button type="submit" className="draw-button" disabled={saving || loading}>Update Vendor Prefix</button>
931|            </form>
932|          </section>
933|
934|          <section className="card" style={{ marginTop: 12 }}>
935|            <h2>Banners</h2>
936|            <form className="vendor-form" onSubmit={addBanner}>
937|              <label className="muted tiny">
938|                Banner title
939|                <input value={bannerTitle} onChange={(e) => setBannerTitle(e.target.value)} placeholder="Banner title" required />
940|              </label>
941|              <label className="muted tiny">
942|                Banner image URL
943|                <input value={bannerImageUrl} onChange={(e) => setBannerImageUrl(e.target.value)} placeholder="Banner image URL" required />
944|              </label>
945|              <label className="muted tiny">
946|                Target URL (optional)
947|                <input value={bannerTargetUrl} onChange={(e) => setBannerTargetUrl(e.target.value)} placeholder="Target URL (optional)" />
948|              </label>
949|              <button type="submit" className="draw-button" disabled={saving || loading}>Add Banner</button>
950|            </form>
951|
952|            <div className="banner-admin-list">
953|              {banners.map((banner) => (
954|                <div className="banner-admin-row" key={banner.id}>
955|                  <img src={banner.imageUrl} alt={banner.title} />
956|                  <div>
957|                    <strong>{banner.title}</strong>
958|                    <div className="muted tiny">Order {banner.sortOrder}</div>
959|                  </div>
960|                  <button type="button" className="sort-pill" onClick={() => void deleteBanner(banner.id)} disabled={saving}>Delete</button>
961|                </div>
962|              ))}
963|            </div>
964|          </section>
965|
966|          <section className="card" style={{ marginTop: 12 }}>
967|            <h2>Referral Signups</h2>
968|            <p className="muted tiny">Referral URL: <code>/register?ref={vendor?.referralCode ?? ""}</code></p>
969|            <div className="result-list">
970|              {referrals.map((row) => (
971|                <div className="result-row" key={row.id}>
972|                  <span>{row.displayName || row.email}</span>
973|                  <span>{new Date(row.referredAt).toLocaleString()}</span>
974|                </div>
975|              ))}
976|              {referrals.length === 0 ? <p className="muted tiny">No referral signups yet.</p> : null}
977|            </div>
978|          </section>
979|
980|          <section className="card" style={{ marginTop: 12 }}>
981|            <h2>Generate QR Points</h2>
982|            <form className="vendor-form" onSubmit={generateQr}>
983|              <label className="muted tiny">
984|                Points to grant
985|                <input value={qrPoints} onChange={(e) => setQrPoints(e.target.value)} type="number" min={1} placeholder="Points to grant" required />
986|              </label>
987|              <label className="muted tiny">
988|                Expiry minutes
989|                <input value={qrExpiryMinutes} onChange={(e) => setQrExpiryMinutes(e.target.value)} type="number" min={1} max={1440} placeholder="Expiry minutes" required />
990|              </label>
991|              <button type="submit" className="draw-button" disabled={saving}>Generate QR Token</button>
992|            </form>
993|            <div className="result-list">
994|              {qrs.map((row) => (
995|                <div className="result-row" key={row.id}>
996|                  <span>{row.token}</span>
997|                  <span>{row.points} pts | {row.status}</span>
998|                  <button type="button" className="sort-pill" onClick={() => setActiveQr(row)}>Display QR</button>
999|                </div>
1000|              ))}
1001|            </div>
1002|          </section>
1003|        </>
1004|      ) : null}
1005|
1006|      {activeTab === "PACKS" ? (
1007|        <>
1008|          <section className="card" style={{ marginTop: 12 }}>
1009|            <h2>{editingPackId ? "Edit Pack" : "Create Pack"}</h2>
1010|            <p className="muted tiny">Item limit: {totalDraftItems}/{limits.maxPackItems} | Tier limit: {tiers.length}/{limits.maxPackTiers}</p>
1011|
1012|            <form className="pack-builder" onSubmit={submitPack}>
1013|              <div className="pack-builder-grid">
1014|                <label className="muted tiny">
1015|                  Pack name
1016|                  <input value={packTitle} onChange={(e) => setPackTitle(e.target.value)} placeholder="Pack Name" required minLength={2} maxLength={120} />
1017|                </label>
1018|                <label className="muted tiny">
1019|                  Price (points)
1020|                  <input type="number" min={1} value={pricePoints} onChange={(e) => setPricePoints(e.target.value)} placeholder="Price (points)" required />
1021|                </label>
1022|                <label className="muted tiny">
1023|                  Total stock
1024|                  <input type="number" min={1} value={totalStock} onChange={(e) => setTotalStock(e.target.value)} placeholder="Total stock" required />
1025|                </label>
1026|                <label className="muted tiny">
1027|                  Limited label (optional)
1028|                  <input type="text" value={limitedLabel} onChange={(e) => setLimitedLabel(e.target.value)} placeholder="Limited label (optional)" />
1029|                </label>
1030|                <label className="muted tiny">
1031|                  Start date-time
1032|                  <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
1033|                </label>
1034|                <label className="muted tiny">
1035|                  End date-time
1036|                  <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
1037|                </label>
1038|                <label className="muted tiny">
1039|                  Pack status
1040|                  <select value={status} onChange={(e) => setStatus(e.target.value as "DRAFT" | "LIVE")}>
1041|                    <option value="DRAFT">DRAFT</option>
1042|                    <option value="LIVE">LIVE</option>
1043|                  </select>
1044|                </label>
1045|                <label className="muted tiny">
1046|                  Draw limit mode
1047|                  <select value={drawLimitMode} onChange={(e) => setDrawLimitMode(e.target.value as "NONE" | "ONCE_PER_CUSTOMER" | "DAILY_RESET")}>
1048|                    <option value="NONE">No limit</option>
1049|                    <option value="ONCE_PER_CUSTOMER">One time per customer</option>
1050|                    <option value="DAILY_RESET">Daily limit (GMT+8 default)</option>
1051|                  </select>
1052|                </label>
1053|                {drawLimitMode === "DAILY_RESET" ? (
1054|                  <>
1055|                    <label className="muted tiny">
1056|                      Daily max draws per customer
1057|                      <input type="number" min={1} value={drawLimitValue} onChange={(e) => setDrawLimitValue(e.target.value)} placeholder="Daily max draws per customer" />
1058|                    </label>
1059|                    <label className="muted tiny">
1060|                      Reset timezone
1061|                      <input type="text" value={drawLimitResetTimezone} onChange={(e) => setDrawLimitResetTimezone(e.target.value)} placeholder="Timezone e.g. Asia/Singapore" />
1062|                    </label>
1063|                  </>
1064|                ) : null}
1065|              </div>
1066|
1067|              <label className="muted tiny">
1068|                <input type="checkbox" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} /> Mark as New
1069|              </label>
1070|
1071|              <label className="muted tiny">
1072|                Important notes shown on pack page
1073|                <textarea value={importantNotes} onChange={(e) => setImportantNotes(e.target.value)} placeholder="Important notes shown on pack page" maxLength={2000} />
1074|              </label>
1075|
1076|              <div className="tier-stack">
1077|                {tiers.map((tier, tierIndex) => (
1078|                  <article key={`tier-${tierIndex}`} className="card tier-card">
1079|                    <div className="heading-row">
1080|                      <strong>Tier {tierIndex + 1}</strong>
1081|                      <button type="button" className="sort-pill" onClick={() => removeTier(tierIndex)} disabled={tiers.length <= 1}>Remove Tier</button>
1082|                    </div>
1083|
1084|                    <div className="pack-builder-grid">
1085|                      <label className="muted tiny">
1086|                        Tier name
1087|                        <input value={tier.name} onChange={(e) => updateTier(tierIndex, "name", e.target.value)} placeholder="Tier name (e.g. A Tier)" required />
1088|                      </label>
1089|                      <label className="muted tiny">
1090|                        Tier percentage
1091|                        <input value={tier.percentage} onChange={(e) => updateTier(tierIndex, "percentage", e.target.value)} placeholder="Tier % (optional, auto if blank)" type="number" min={0} max={100} step="0.0001" />
1092|                      </label>
1093|                    </div>
1094|
1095|                    <div className="tier-items">
1096|                      {tier.items.map((item, itemIndex) => (
1097|                        <div className="item-row" key={`tier-${tierIndex}-item-${itemIndex}`}>
1098|                          <label className="muted tiny">
1099|                            Item label
1100|                            <input

## apps/web/lib/api.ts

### lines 1-80

1|const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
2|
3|export async function fetchVendorByHost(host: string) {
4|  const url = new URL("/v1/vendors/by-host", apiBase);
5|  url.searchParams.set("host", host);
6|  const response = await fetch(url, { cache: "no-store" });
7|  if (!response.ok) return null;
8|  return response.json();
9|}

## package.json

### lines 1-120

1|{
2|  "name": "oripa-saas",
3|  "private": true,
4|  "version": "0.1.0",
5|  "workspaces": [
6|    "apps/*",
7|    "packages/*"
8|  ],
9|  "scripts": {
10|    "dev": "concurrently -n api,web,worker -c blue,green,yellow \"npm run dev -w @oripa/api\" \"npm run dev -w @oripa/web\" \"npm run dev -w @oripa/worker\"",
11|    "build": "npm run build -w @oripa/shared && npm run build -w @oripa/api && npm run build -w @oripa/web && npm run build -w @oripa/worker",
12|    "lint": "npm run lint -w @oripa/api && npm run lint -w @oripa/web && npm run lint -w @oripa/worker",
13|    "db:generate": "prisma generate --schema prisma/schema.prisma",
14|    "db:studio": "prisma studio --schema prisma/schema.prisma --port 5555",
15|    "db:migrate": "prisma migrate dev --schema prisma/schema.prisma",
16|    "db:seed": "tsx prisma/seed.ts",
17|    "catalog:sync:tcgtracking": "npm run catalog:sync:tcgtracking -w @oripa/api",
18|    "catalog:sync:tcgdex": "npm run catalog:sync:tcgdex -w @oripa/api"
19|  },
20|  "devDependencies": {
21|    "@types/node": "^22.15.30",
22|    "concurrently": "^9.1.2",
23|    "prisma": "^6.9.0",
24|    "tsx": "^4.19.4",
25|    "typescript": "^5.8.3"
26|  },
27|  "dependencies": {
28|    "@prisma/client": "^6.9.0"
29|  }
30|}

## apps/api/package.json

### lines 1-120

1|{
2|  "name": "@oripa/api",
3|  "version": "0.1.0",
4|  "main": "dist/index.js",
5|  "scripts": {
6|    "dev": "tsx watch src/index.ts",
7|    "build": "tsc -p tsconfig.json",
8|    "start": "node dist/index.js",
9|    "lint": "node -e \"console.log('lint: add eslint config when ready')\"",
10|    "catalog:sync:tcgtracking": "tsx scripts/sync-tcgtracking.ts",
11|    "catalog:sync:tcgdex": "tsx scripts/sync-tcgdex.ts",
12|    "test:catalog:tcgdex": "tsx scripts/test-tcgdex-normalizer.ts"
13|  },
14|  "dependencies": {
15|    "@oripa/shared": "0.1.0",
16|    "@prisma/client": "^6.9.0",
17|    "bcryptjs": "^3.0.3",
18|    "bullmq": "^5.56.2",
19|    "cors": "^2.8.5",
20|    "dotenv": "^16.4.7",
21|    "express": "^4.21.2",
22|    "helmet": "^8.0.0",
23|    "ioredis": "^5.4.2",
24|    "jsonwebtoken": "^9.0.3",
25|    "morgan": "^1.10.0",
26|    "nodemailer": "^6.9.16",
27|    "passport": "^0.7.0",
28|    "passport-apple": "^2.0.2",
29|    "passport-google-oauth20": "^2.0.0",
30|    "zod": "^3.25.67"
31|  },
32|  "devDependencies": {
33|    "@types/cors": "^2.8.17",
34|    "@types/express": "^4.17.21",
35|    "@types/jsonwebtoken": "^9.0.10",
36|    "@types/morgan": "^1.9.9",
37|    "@types/node": "^22.15.30",
38|    "@types/nodemailer": "^6.4.17",
39|    "@types/passport": "^1.0.17",
40|    "@types/passport-apple": "^2.0.3",
41|    "@types/passport-google-oauth20": "^2.0.17",
42|    "tsx": "^4.19.4",
43|    "typescript": "^5.8.3"
44|  }
45|}

## PROJECTS.md

### lines 1-160

1|# Oripa SaaS Project Workflow
2|
3|**Created:** 2026-05-29T02:28:51Z
4|**Owner:** Yeqiuqiu / Oripa SaaS
5|**Target repo:** `/home/yeqiuqiu/oripa_saas`
6|**Canonical CAR + Stories source:** `docs/oripa-saas-reconciled-car-customer-stories-proposal.md`
7|**Workflow companion:** `docs/current-oripa-workflow.md`
8|
9|## Current posture
10|
11|This project now uses the reconciled CAR + Customer Stories document as the canonical product/engineering workflow input.
12|
13|Earlier source-family documents under `docs/legacy references/` are provenance only. They should not be used as parallel ticketing sources unless a ticket explicitly needs source verification.
14|
15|## Objective
16|
17|Build Oripa SaaS as a safe, tenant-scoped, points-led mystery-pack platform where wallet, draw, catalog/prize metadata, prize entitlement, proof/snapshot, support, and fulfillment surfaces are implemented only when their CARs and stories are satisfied.
18|
19|## Non-goals
20|
21|- No payment checkout / Stripe / crypto / deposits unless a separate funding decision replaces seeded/manual pilot credits.
22|- No cashout, withdrawal, fixed point-dollar equivalence, or bonus-value copy.
23|- No public provably-fair claim unless verifier inputs, test vectors, seed lifecycle, and customer proof UX exist.
24|- No shipping/delivery/redemption promise unless fulfillment foundation is implemented.
25|- No marketplace, trading, web3, voucher, promo/free value, public activity, EV/value-band, or demo-value claims until their gated stories are explicitly picked up.
26|
27|## Allowed write roots
28|
29|- Repo code and docs under `/home/yeqiuqiu/oripa_saas`
30|- Database migrations/scripts only after explicit live-DB approval when they affect Render/live data
31|
32|## Gate 1 — DEFINE
33|
34|Current canonical source is defined:
35|
36|- CARs: `CAR-01` through `CAR-18` in `docs/oripa-saas-reconciled-car-customer-stories-proposal.md`
37|- Customer/operator stories: `STORY-01` through `STORY-23`
38|- Launch blocker priority: `P0 — launch-safety blockers`
39|- Decision gate: `Decision Gate 0 — pre-ticket launch assumptions and decision tickets`
40|
41|Before any implementation ticket starts, it must declare:
42|
43|- CAR ID(s)
44|- Story ID(s)
45|- Priority: P0/P1/P2/P3
46|- Concrete acceptance criteria copied/adapted from the canonical doc
47|- Verification command(s) or inspection evidence
48|- Copy/claim gates affected
49|
50|## Gate 2 — DESIGN
51|
52|Default launch decisions until overridden by explicit decision tickets:
53|
54|- Funding path: seeded/manual pilot credit only.
55|- Product mode MVP: `one_prize_pack`; collapse `single_pull` unless justified.
56|- Proof tier: internal audit/snapshot only; no public provably-fair claim.
57|- Return-to-points: hidden unless explicitly advertised and implemented.
58|- Odds disclosure: hide exact odds/ticket tables unless transaction-pool snapshot validation exists.
59|- Policy storage: must be versioned policy records or immutable draw-time policy snapshots before launch claims depend on it.
60|- Fulfillment: if physical prize promise is visible, admin-assisted fulfillment foundation becomes P0; otherwise hide fulfillment/shipping copy.
61|
62|## Gate 3 — BUILD
63|
64|Implementation order follows the canonical handoff:
65|
66|1. Decision Gate 0 tickets.
67|2. Wallet JWT user scoping and tenant boundaries.
68|3. Product modes and state machines.
69|4. Immutable wallet ledger for seeded/manual pilot credits.
70|5. Centralized availability/eligibility/supported-action reason codes.
71|6. Copy/capability gates and policy version capture.
72|7. Physical item eligibility/allocation/discrepancy controls.
73|8. Idempotent transactional paid draw with snapshot/proof and userPrize creation.
74|9. Product detail disclosure.
75|10. Draw history/audit/snapshot UX and support trace.
76|11. Public API hygiene tests/customer-safe errors.
77|12. Customer inventory/history surfaces.
78|13. Return-to-points only after inventory + ledger + idempotency + value policy are stable.
79|14. Discovery/metadata/family/tier surfaces.
80|15. Fulfillment foundation if physical prize promise is in launch scope.
81|16. Public activity, EV/value bands, demo/free/promo/voucher/marketplace only after trust foundation is stable.
82|
83|## Gate 4 — VERIFY
84|
85|Every completed slice must provide evidence:
86|
87|- API build: `npm run build -w @oripa/api`
88|- Web build when UI touched: `npm run build -w @oripa/web`
89|- Shared package build when types/contracts touched: `npm run build -w @oripa/shared`
90|- Targeted tests or script output for the slice
91|- Manual inspection notes for docs-only or migration-only work
92|- Copy-gate check: no unsupported claims exposed in UI/API strings
93|- Scope check: no live DB writes/migrations unless explicitly approved
94|
95|## Gate 5 — SHIP
96|
97|A slice can ship only when:
98|
99|- All mapped story acceptance criteria pass or are explicitly deferred.
100|- Any deferred acceptance criteria are listed in follow-up tickets.
101|- Public copy matches implemented capability flags.
102|- Customer-visible claims are allowed by the canonical CAR copy gates.
103|- Support/audit path exists for customer-money/prize-impacting flows.
104|- Live migration/deployment steps are written separately and approved before execution.
105|
106|## Decision log
107|
108|### D-001 — Adopt reconciled CAR + Customer Stories as workflow source
109|
110|- **Timestamp:** 2026-05-29T02:28:51Z
111|- **Phase:** DEFINE
112|- **Decision:** Use `docs/oripa-saas-reconciled-car-customer-stories-proposal.md` as the canonical CAR/stories source for current Oripa SaaS workflow.
113|- **Rationale:** It reconciles Clove/current baseline, Phygitals, Collector Crypt, and Packs references into one gated implementation source with copy-safety boundaries.
114|- **Scope impact:** narrows — prevents parallel ticket generation from older source-family docs.
115|- **Acceptance impact:** all tickets must map to CAR/story IDs and acceptance criteria.
116|- **Verification:** inspect this `PROJECTS.md` plus `docs/current-oripa-workflow.md`.
117|
118|## Active slice note — CatalogItem / TCGTracking
119|
120|The CatalogItem + TCGTracking work is a catalog/source-data slice, not an inventory ownership slice.
121|
122|Map it primarily to:
123|
124|- `CAR-09` — Safe pack disclosure and prize metadata
125|- `CAR-10` — Category, tag, sort, family, tier, and code discovery
126|- `STORY-12` — Inspect structured collectible details
127|- `STORY-16` — Validate product readiness before publish
128|
129|It must not imply vendor stock, prize ownership, fulfillment, authentication, valuation, or proof unless those later slices are implemented.

## docs/current-oripa-workflow.md

### lines 1-180

1|# Current Oripa SaaS Workflow — CAR + Stories
2|
3|**Canonical source:** `docs/oripa-saas-reconciled-car-customer-stories-proposal.md`
4|**Project cockpit:** `PROJECTS.md`
5|**Status:** canonical for current ticketing/workflow as of 2026-05-29T02:28:51Z
6|
7|## Rule
8|
9|Use the reconciled CAR + Customer Stories document as the source of truth for current Oripa SaaS work.
10|
11|Do not create implementation tickets directly from older source-family docs. Older docs remain evidence/provenance only.
12|
13|## Ticket template
14|
15|Every implementation ticket should start with:
16|
17|```md
18|## Scope
19|- CAR: CAR-XX — <title>
20|- Story: STORY-XX — <title>
21|- Priority: P0/P1/P2/P3
22|- Source: docs/oripa-saas-reconciled-car-customer-stories-proposal.md
23|
24|## Customer / operator value
25|<one sentence from story/CAR Result>
26|
27|## Acceptance criteria
28|- <copied/adapted from canonical story>
29|
30|## Verification
31|- API: `npm run build -w @oripa/api`
32|- Web, if touched: `npm run build -w @oripa/web`
33|- Shared, if touched: `npm run build -w @oripa/shared`
34|- Targeted tests/scripts: <exact command>
35|- Copy-gate check: <unsupported claims hidden?>
36|
37|## Non-goals
38|- <explicitly name roadmap/copy/payment/fulfillment/proof exclusions>
39|```
40|
41|## P0 ticketing order
42|
43|Use this order unless a production blocker forces a narrower fix:
44|
45|1. Decision Gate 0 tickets
46|   - Funding path
47|   - Fulfillment scope
48|   - Proof tier
49|   - Return-to-points scope
50|   - Odds disclosure level
51|   - Policy/version storage
52|   - `single_pull` versus `one_prize_pack`
53|
54|2. `CAR-01` / `STORY-01`
55|   - Authenticated user scope and vendor scope for sensitive reads/writes.
56|
57|3. `CAR-04` / `STORY-04`
58|   - Canonical product modes and state model.
59|
60|4. `CAR-02` / `STORY-02` / `STORY-03` / `STORY-20`
61|   - Immutable wallet ledger and seeded/manual pilot credit path.
62|
63|5. `CAR-03` / `STORY-05` / `STORY-21`
64|   - Central eligibility/availability/supported-action service.
65|
66|6. `CAR-15` / `STORY-19` / `STORY-22` / `STORY-23`
67|   - Copy/capability gates, customer-safe public APIs, policy/version capture.
68|
69|7. `CAR-08` / `STORY-11` / `STORY-16`
70|   - Physical item eligibility, allocation, discrepancy controls, publish validation.
71|
72|8. `CAR-05` / `STORY-08`
73|   - Atomic idempotent paid draw transaction.
74|
75|9. `CAR-06` / `STORY-09`
76|   - Draw-time snapshot/proof boundary.
77|
78|10. `CAR-07` / `STORY-10`
79|    - Durable userPrize inventory from successful draw.
80|
81|11. `CAR-13` / `STORY-15`
82|    - Support trace and operational auditability.
83|
84|12. `CAR-12` / `STORY-14`, only if physical prize promise is in launch scope
85|    - Admin-assisted fulfillment foundation.
86|
87|## P1/P2 lanes after trust foundation
88|
89|- `CAR-09` / `STORY-06` / `STORY-12`: product detail disclosure and structured collectible metadata.
90|- `CAR-10`: category, tag, sort, family, tier, code discovery.
91|- `CAR-11` / `STORY-13`: return-to-points, only if advertised.
92|- `CAR-14` / `STORY-17`: privacy-safe public proof/social signals.
93|- `CAR-16`: customer history surfaces.
94|- `CAR-17` / `STORY-18`: demo/promo/voucher/open-later gates.
95|- `CAR-18`: future-proofing without roadmap leakage.
96|
97|## Active CatalogItem / TCGTracking mapping
98|
99|The current CatalogItem + TCGTracking work is not the whole prize/inventory system.
100|
101|Use this mapping:
102|
103|- Primary CAR: `CAR-10 — Category, tag, sort, family, tier, and code discovery`
104|- Supporting CAR: `CAR-09 — Safe pack disclosure and prize metadata`
105|- Primary story: `STORY-12 — Inspect structured collectible details`
106|- Supporting story: `STORY-16 — Validate product readiness before publish`
107|
108|Acceptance for the CatalogItem / TCGTracking slice:
109|
110|- TCGTracking products normalize into source-backed `CatalogItem` rows.
111|- `CatalogItem` remains a global catalog/reference projection, not vendor inventory.
112|- Vendor stock, prize ownership, fulfillment status, grading cert ownership, cost basis, and pack allocation stay out of `CatalogItem` unless represented as references/metadata only.
113|- Search supports name/set/card-number/source-backed metadata enough for admin/vendor selection.
114|- Pilot imports are dry-run by default and live DB writes require explicit approval.
115|- UI/API copy must not imply a catalog item is owned, vaulted, fulfilled, authenticated, insured, priced, or prize-eligible until inventory/publish validation slices support that claim.
116|
117|## Copy gates to enforce everywhere
118|
119|Blocked until implemented and approved:
120|
121|- “Buy points” / checkout / deposits
122|- `1 point = $1`
123|- Cashout / withdrawal / sell for cash
124|- Guaranteed shipping / instant delivery / redemption if fulfillment foundation is missing
125|- Provably fair / fair odds if public verifier is missing
126|- Live odds / exact odds if transaction-pool snapshot validation is missing
127|- Authenticated / vaulted / insured / scanned unless ops evidence exists
128|- Marketplace / trade / transfer / peer sale
129|- Crypto / web3 / NFT / Solana / Moonpay / Privy rails
130|
131|## Definition of done for any slice
132|
133|A slice is done only when:
134|
135|- Mapped CAR/story acceptance criteria are satisfied or explicitly deferred.
136|- Build/test commands relevant to touched packages pass.
137|- Public copy has been checked against capability flags.
138|- Cross-user/cross-vendor behavior is covered if the slice touches sensitive records.
139|- Live DB changes are separated into explicit migration/runbook steps and not applied without approval.
