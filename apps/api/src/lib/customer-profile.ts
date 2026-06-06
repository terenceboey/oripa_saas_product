export type CustomerProfileInput = {
  displayName?: unknown;
  age?: unknown;
  country?: unknown;
};

export type CustomerProfilePatch = {
  displayName: string;
  age: number;
  country: string;
};

export function normalizeCustomerProfileInput(input: CustomerProfileInput): CustomerProfilePatch {
  const displayName = String(input.displayName ?? "").trim();
  const country = String(input.country ?? "").trim();
  const rawAge = typeof input.age === "number" ? input.age : Number(String(input.age ?? "").trim());

  if (!displayName) throw new Error("name is required");
  if (displayName.length > 80) throw new Error("name must be 80 characters or less");
  if (!Number.isInteger(rawAge)) throw new Error("age must be a whole number");
  if (rawAge < 13 || rawAge > 120) throw new Error("age must be between 13 and 120");
  if (!country) throw new Error("country is required");
  if (country.length > 80) throw new Error("country must be 80 characters or less");

  return {
    displayName,
    age: rawAge,
    country,
  };
}

export function isCustomerProfileComplete(user: { displayName?: string | null; age?: number | null; country?: string | null }) {
  return Boolean(String(user.displayName ?? "").trim() && user.age && String(user.country ?? "").trim());
}
