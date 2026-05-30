import { prisma } from "../src/lib/prisma";

const SOURCE = "tcgtracking";

type SourceCountRow = { source: string; count: bigint };
type SourceItemTypeCountRow = { source: string; itemType: string | null; count: bigint };
type DuplicateKeyRow = {
  source: string;
  sourceItemId: string;
  language: string;
  duplicateCount: bigint;
};
type SetCountRow = { source: string; setId: string | null; count: bigint };
type RecentRow = {
  id: string;
  source: string;
  sourceItemId: string;
  itemType: string | null;
  language: string | null;
  name: string | null;
  setId: string | null;
  setName: string | null;
  hasImage: boolean;
  createdAt: Date | null;
};

function asNumber(value: bigint | number): number {
  return typeof value === "bigint" ? Number(value) : value;
}

function printSection(title: string) {
  console.log(`\n[catalog-report] ${title}`);
}

async function main() {
  const [
    countBySource,
    countBySourceAndItemType,
    recentTcgtracking,
    duplicateSourceKeys,
    missingImageCount,
    tcgtrackingCountBySet,
  ] = await Promise.all([
    prisma.$queryRaw<SourceCountRow[]>`
      SELECT "source", COUNT(*)::bigint AS "count"
      FROM "CatalogItem"
      GROUP BY "source"
      ORDER BY "source" ASC
    `,
    prisma.$queryRaw<SourceItemTypeCountRow[]>`
      SELECT
        "source",
        COALESCE(to_jsonb("CatalogItem") ->> 'itemType', 'UNKNOWN') AS "itemType",
        COUNT(*)::bigint AS "count"
      FROM "CatalogItem"
      GROUP BY "source", COALESCE(to_jsonb("CatalogItem") ->> 'itemType', 'UNKNOWN')
      ORDER BY "source" ASC, "itemType" ASC
    `,
    prisma.$queryRaw<RecentRow[]>`
      SELECT
        "id",
        "source",
        "sourceItemId",
        to_jsonb("CatalogItem") ->> 'itemType' AS "itemType",
        to_jsonb("CatalogItem") ->> 'language' AS "language",
        to_jsonb("CatalogItem") ->> 'name' AS "name",
        to_jsonb("CatalogItem") ->> 'setId' AS "setId",
        to_jsonb("CatalogItem") ->> 'setName' AS "setName",
        COALESCE(NULLIF(to_jsonb("CatalogItem") ->> 'imageThumbUrl', ''), NULLIF(to_jsonb("CatalogItem") ->> 'imageLargeUrl', '')) IS NOT NULL AS "hasImage",
        "createdAt"
      FROM "CatalogItem"
      WHERE "source" = ${SOURCE}
      ORDER BY "createdAt" DESC
      LIMIT 20
    `,
    prisma.$queryRaw<DuplicateKeyRow[]>`
      SELECT "source", "sourceItemId", "language", COUNT(*)::bigint AS "duplicateCount"
      FROM "CatalogItem"
      GROUP BY "source", "sourceItemId", "language"
      HAVING COUNT(*) > 1
      ORDER BY "duplicateCount" DESC, "source" ASC, "sourceItemId" ASC, "language" ASC
    `,
    prisma.$queryRaw<{ missingImageCount: bigint }[]>`
      SELECT COUNT(*)::bigint AS "missingImageCount"
      FROM "CatalogItem"
      WHERE "source" = ${SOURCE}
        AND COALESCE(NULLIF(to_jsonb("CatalogItem") ->> 'imageThumbUrl', ''), NULLIF(to_jsonb("CatalogItem") ->> 'imageLargeUrl', '')) IS NULL
    `,
    prisma.$queryRaw<SetCountRow[]>`
      SELECT "source", to_jsonb("CatalogItem") ->> 'setId' AS "setId", COUNT(*)::bigint AS "count"
      FROM "CatalogItem"
      WHERE "source" = ${SOURCE}
      GROUP BY "source", to_jsonb("CatalogItem") ->> 'setId'
      ORDER BY "count" DESC, "setId" ASC NULLS FIRST
    `,
  ]);

  printSection("count by source");
  if (!countBySource.length) {
    console.log("(no rows)");
  }
  for (const row of countBySource) {
    console.log(`source=${row.source} count=${asNumber(row.count)}`);
  }

  printSection("count by source + itemType");
  if (!countBySourceAndItemType.length) {
    console.log("(no rows)");
  }
  for (const row of countBySourceAndItemType) {
    console.log(`source=${row.source} itemType=${row.itemType} count=${asNumber(row.count)}`);
  }

  printSection("recent 20 tcgtracking rows");
  if (!recentTcgtracking.length) {
    console.log("(no rows)");
  }
  for (const row of recentTcgtracking) {
    console.log(
      JSON.stringify({
        id: row.id,
        source: row.source,
        sourceItemId: row.sourceItemId,
        itemType: row.itemType,
        language: row.language,
        name: row.name,
        setId: row.setId,
        setName: row.setName,
        hasImage: row.hasImage,
        createdAt: row.createdAt ? row.createdAt.toISOString() : null,
      }),
    );
  }

  printSection("duplicate [source, sourceItemId, language] check");
  console.log(`duplicateGroups=${duplicateSourceKeys.length}`);
  for (const row of duplicateSourceKeys) {
    console.log(
      `source=${row.source} sourceItemId=${row.sourceItemId} language=${row.language} duplicateCount=${asNumber(row.duplicateCount)}`,
    );
  }

  printSection("missing image count for source=tcgtracking");
  console.log(`source=${SOURCE} missingImageCount=${asNumber(missingImageCount[0]?.missingImageCount ?? 0)}`);

  printSection("count by source=tcgtracking + setId (rollback targeting)");
  if (!tcgtrackingCountBySet.length) {
    console.log("(no rows)");
  }
  for (const row of tcgtrackingCountBySet) {
    console.log(`source=${row.source} setId=${row.setId ?? "null"} count=${asNumber(row.count)}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error("[catalog-report] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
