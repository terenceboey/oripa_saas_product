import { isCustomerProfileComplete, normalizeCustomerProfileInput } from "../src/lib/customer-profile";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function assertThrows(fn: () => unknown, expectedMessage: string) {
  try {
    fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(message === expectedMessage, `expected '${expectedMessage}', got '${message}'`);
    return;
  }
  throw new Error(`expected throw '${expectedMessage}'`);
}

const normalized = normalizeCustomerProfileInput({
  displayName: "  Alice Collector  ",
  age: "27",
  country: "  Singapore ",
});

assert(normalized.displayName === "Alice Collector", "displayName should trim");
assert(normalized.age === 27, "age should normalize numeric strings");
assert(normalized.country === "Singapore", "country should trim");
assert(isCustomerProfileComplete(normalized), "normalized profile should be complete");
assert(!isCustomerProfileComplete({ displayName: "Alice", age: null, country: "Singapore" }), "age is required for profile completeness");
assert(!isCustomerProfileComplete({ displayName: "Alice", age: 27, country: "" }), "country is required for profile completeness");
assertThrows(() => normalizeCustomerProfileInput({ displayName: "", age: 27, country: "Singapore" }), "name is required");
assertThrows(() => normalizeCustomerProfileInput({ displayName: "Alice", age: 12, country: "Singapore" }), "age must be between 13 and 120");
assertThrows(() => normalizeCustomerProfileInput({ displayName: "Alice", age: "twenty", country: "Singapore" }), "age must be a whole number");
assertThrows(() => normalizeCustomerProfileInput({ displayName: "Alice", age: 27, country: "" }), "country is required");

console.log("customer profile backend contract ok");
