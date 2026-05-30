import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const SOURCE = "tcgtracking";

async function main() {
  const [total, active, missingImage, missingLocalId, missingSourcePayload, samples] = await Promise.all([
    prisma.catalogItem.count({ where: { source: SOURCE } }),
    prisma.catalogItem.count({ where: { source: SOURCE, isActive: true } }),
    prisma.catalogItem.count({ where: { source: SOURCE, imageThumbUrl: null } }),
    prisma.catalogItem.count({ where: { source: SOURCE, localId: null } }),
    prisma.catalogItem.count({ where: { source: SOURCE, sourcePayload: { equals: Prisma.DbNull } } }),
    prisma.catalogItem.findMany({
      where: { source: SOURCE },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        sourceItemId: true,
        name: true,
        setId: true,
        setName: true,
        localId: true,
        rarity: true,
        imageThumbUrl: true,
      },
    }),
  ]);

  const setCounts = await prisma.catalogItem.groupBy({
    by: ["setId", "setName"],
    where: { source: SOURCE },
    _count: { _all: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  console.log("[tcgtracking-report] CatalogItem source-backed import report");
  console.log(`source=${SOURCE}`);
  console.log(`total=${total}`);
  console.log(`active=${active}`);
  console.log(`missingImage=${missingImage}`);
  console.log(`missingLocalId=${missingLocalId}`);
  console.log(`missingSourcePayload=${missingSourcePayload}`);

  console.log("[tcgtracking-report] top sets");
  for (const set of setCounts) {
    console.log(`setId=${set.setId ?? "null"} setName=${set.setName ?? "null"} count=${set._count._all}`);
  }

  console.log("[tcgtracking-report] samples");
  for (const item of samples) {
    console.log(
      JSON.stringify({
        sourceItemId: item.sourceItemId,
        name: item.name,
        setId: item.setId,
        setName: item.setName,
        localId: item.localId,
        rarity: item.rarity,
        hasImage: Boolean(item.imageThumbUrl),
      }),
    );
  }
}

main()
  .catch((error) => {
    console.error("[tcgtracking-report] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
