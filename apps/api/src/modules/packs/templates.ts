import { Prisma } from "@prisma/client";
import type { PoolSnapshotPrizeRow } from "./pool-snapshot";
import { computePoolSnapshotHash } from "./pool-snapshot";
import { buildPackTierSnapshotFromFlatItems } from "./tier-snapshot";

export type PackTemplateSlotForPublish = {
  id: string;
  sortOrder: number;
  label: string;
  imageUrl?: string | null;
  imageLargeUrl?: string | null;
  setId?: string | null;
  setName?: string | null;
  localId?: string | null;
  cardNumber?: string | null;
  rarity?: string | null;
  catalogItemId?: string | null;
  catalogSource?: string | null;
  catalogSourceItemId?: string | null;
  catalogSnapshot?: unknown;
  estimatedValue: number;
  weight: number;
  stock: number;
};

export type PackTemplateVersionForPublish = {
  id: string;
  templateId: string;
  vendorId: string;
  title: string;
  pricePoints: number;
  totalStock: number;
  isNew: boolean;
  limitedLabel?: string | null;
  importantNotes?: string | null;
  drawLimitMode: "NONE" | "ONCE_PER_CUSTOMER" | "DAILY_RESET";
  drawLimitValue?: number | null;
  drawLimitResetTimezone?: string | null;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  slots: PackTemplateSlotForPublish[];
};

type PublishTemplateContext = {
  actorUserId: string;
  now: Date;
  idempotencyKey?: string | null;
};

export class PackTemplatePublishError extends Error {
  constructor(
    public readonly reason: "empty_template" | "invalid_total_stock",
    message: string
  ) {
    super(message);
    this.name = "PackTemplatePublishError";
  }
}

export class PackTemplateEditError extends Error {
  constructor(
    public readonly reason: "immutable_version",
    message: string
  ) {
    super(message);
    this.name = "PackTemplateEditError";
  }
}

export function assertTemplateVersionSlotsEditable(version: { status: "DRAFT" | "PUBLISHED" | "ARCHIVED" }) {
  if (version.status !== "DRAFT") {
    throw new PackTemplateEditError(
      "immutable_version",
      "Published or archived template versions cannot have their slots edited"
    );
  }
}

function nullableJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === undefined || value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

export function buildTemplateSlotSnapshotRows(version: PackTemplateVersionForPublish): PoolSnapshotPrizeRow[] {
  return [...version.slots]
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
    .map((slot) => ({
      id: slot.id,
      label: slot.label,
      imageUrl: slot.imageUrl ?? null,
      imageLargeUrl: slot.imageLargeUrl ?? null,
      setId: slot.setId ?? null,
      setName: slot.setName ?? null,
      localId: slot.localId ?? null,
      cardNumber: slot.cardNumber ?? null,
      rarity: slot.rarity ?? null,
      catalogItemId: slot.catalogItemId ?? null,
      catalogSource: slot.catalogSource ?? null,
      catalogSourceItemId: slot.catalogSourceItemId ?? null,
      catalogSnapshot: slot.catalogSnapshot ?? null,
      estimatedValue: slot.estimatedValue,
      weight: slot.weight,
      stock: slot.stock,
      remainingStock: slot.stock,
    }));
}

export function buildPackCreateDataFromTemplateVersion(version: PackTemplateVersionForPublish, context: PublishTemplateContext) {
  const prizeRows = buildTemplateSlotSnapshotRows(version);
  if (prizeRows.length === 0) {
    throw new PackTemplatePublishError("empty_template", "Template version cannot be published without slots");
  }
  if (version.totalStock <= 0) {
    throw new PackTemplatePublishError("invalid_total_stock", "Template version totalStock must be positive");
  }

  return {
    vendorId: version.vendorId,
    title: version.title,
    pricePoints: version.pricePoints,
    totalStock: version.totalStock,
    remainingStock: version.totalStock,
    startsAt: version.startsAt ? new Date(version.startsAt) : null,
    endsAt: version.endsAt ? new Date(version.endsAt) : null,
    isNew: version.isNew,
    limitedLabel: version.limitedLabel ?? null,
    importantNotes: version.importantNotes ?? null,
    status: "LIVE" as const,
    sourceTemplateType: "VENDOR_TEMPLATE" as const,
    sourceTemplateId: version.templateId,
    sourceTemplateVersionId: version.id,
    poolSnapshotHash: computePoolSnapshotHash(prizeRows),
    tierSnapshotJson: buildPackTierSnapshotFromFlatItems(
      prizeRows.map((row) => ({
        label: row.label,
        estimatedValue: row.estimatedValue,
        stock: row.stock,
        imageUrl: row.imageUrl ?? null,
        catalogItemId: row.catalogItemId ?? null,
        catalogSource: row.catalogSource ?? null,
        catalogSourceItemId: row.catalogSourceItemId ?? null,
        language: null,
      })),
      "Template Pool"
    ) as Prisma.InputJsonValue,
    poolSnapshotVersion: 1,
    publishedFromTemplateAt: context.now,
    publishedByUserId: context.actorUserId,
    publishIdempotencyKey: context.idempotencyKey ?? null,
    drawLimitMode: version.drawLimitMode,
    drawLimitValue: version.drawLimitValue ?? null,
    drawLimitResetTimezone: version.drawLimitResetTimezone ?? null,
    prizes: {
      createMany: {
        data: prizeRows.map((row) => ({
          label: row.label,
          imageUrl: row.imageUrl,
          imageLargeUrl: row.imageLargeUrl,
          setId: row.setId,
          setName: row.setName,
          localId: row.localId,
          cardNumber: row.cardNumber,
          rarity: row.rarity,
          catalogItemId: row.catalogItemId,
          catalogSource: row.catalogSource,
          catalogSourceItemId: row.catalogSourceItemId,
          catalogSnapshot: nullableJson(row.catalogSnapshot),
          estimatedValue: row.estimatedValue,
          weight: row.weight,
          stock: row.stock,
          remainingStock: row.remainingStock,
        })),
      },
    },
  };
}

export function packTemplatePublishErrorResponse(reason: PackTemplatePublishError["reason"]) {
  if (reason === "empty_template") {
    return {
      error: "Template cannot be published",
      message: "Template versions cannot publish live packs without slot rows.",
    };
  }
  return {
    error: "Template cannot be published",
    message: "Template version totalStock must be positive.",
  };
}
