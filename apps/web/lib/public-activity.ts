export type PublicActivity = {
  packTitle: string;
  prizeLabel: string;
  valueBand: string | null;
  timestamp: string;
  customerLabel: string | null;
};

const suspiciousCustomerLabel = /@|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|(?:\d[\s-]?){8,}/i;

export function normalizePublicActivities(input: unknown): PublicActivity[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const packTitle = normalizeText(candidate.packTitle);
    const prizeLabel = normalizeText(candidate.prizeLabel);
    const timestamp = normalizeText(candidate.timestamp);
    if (!packTitle || !prizeLabel || !timestamp) return [];

    return [{
      packTitle,
      prizeLabel,
      valueBand: normalizeText(candidate.valueBand),
      timestamp,
      customerLabel: sanitizeCustomerLabel(candidate.customerLabel),
    }];
  });
}

export function filterPublicActivitiesByPackTitle(activities: PublicActivity[], packTitle?: string | null) {
  const normalizedPackTitle = packTitle?.trim().toLowerCase();
  if (!normalizedPackTitle) return activities;
  return activities.filter((activity) => activity.packTitle.trim().toLowerCase() === normalizedPackTitle);
}

export function formatPublicActivityTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function sanitizeCustomerLabel(value: unknown) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (suspiciousCustomerLabel.test(normalized)) return null;
  return normalized;
}
