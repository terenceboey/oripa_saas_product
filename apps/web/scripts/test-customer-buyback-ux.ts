import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const backpackPage = readFileSync("app/customer/items/page.tsx", "utf8");
const packPage = readFileSync("app/pack/[packId]/page.tsx", "utf8");

assert.match(backpackPage, /\/v1\/customer\/buyback-quotes\/\$\{quote\.id\}\/accept/, "backpack page must accept buyback quotes through the customer accept endpoint");
assert.match(backpackPage, /isQuoteExpired\(/, "backpack page must detect expired quotes client-side");
assert.match(backpackPage, /disabled=\{acceptBusy \|\| expired\}/, "backpack page must disable quote accept when expired");
assert.match(backpackPage, /loadWallet\(\)/, "backpack page must refresh wallet data after accepting a quote");
assert.match(backpackPage, /textarea/i, "backpack page must render a redemption note textarea");
assert.match(backpackPage, /maxLength=\{500\}/, "backpack redemption note must be capped at 500 characters");
assert.match(backpackPage, /note:\s*normalizedNote/, "backpack page must post the normalized redemption note");
assert.match(backpackPage, /trim\(\)/, "backpack page must trim the redemption note before submit");
assert.match(backpackPage, /active request/i, "backpack page must explain when actions are disabled by an active request");
assert.match(backpackPage, /customerNote/, "backpack page must surface request notes in the request history");
assert.doesNotMatch(backpackPage, /cash paid/i, "backpack page must not claim cash payout");
assert.doesNotMatch(backpackPage, /cash quote/i, "backpack page must not label points quote as cash");
assert.doesNotMatch(backpackPage, /shipping\s+provider/i, "backpack page must not mention carrier-integration language");

assert.match(packPage, /quote card/i, "pack result flow must render quote card details when buyback quote exists");
assert.match(packPage, /buybackPercent/, "pack result flow must surface buyback percent details");
assert.match(packPage, /valueSource/, "pack result flow must surface quote value source");
assert.match(packPage, /valueAsOf/, "pack result flow must surface quote value as-of");
assert.match(packPage, /href=\"\/customer\/items\"/, "pack result flow must link customers back to My Backpack");
assert.match(packPage, /Request Redemption/, "pack result flow must expose redemption from the result panel");
assert.match(packPage, /active request/i, "pack result flow must explain active-request blocking");
assert.match(packPage, /BOUGHT_BACK|REDEEMED|VOIDED/, "pack result flow must guard terminal custody statuses");
assert.doesNotMatch(packPage, /cash paid/i, "pack result flow must not claim cash payout");
assert.doesNotMatch(packPage, /shipping\s+provider/i, "pack result flow must not mention carrier-integration language");

console.log("customer buyback UI contract ok");
