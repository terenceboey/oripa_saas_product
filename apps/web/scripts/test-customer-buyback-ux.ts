import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const backpackPage = readFileSync("app/customer/items/page.tsx", "utf8");
const packPage = readFileSync("app/pack/[packId]/page.tsx", "utf8");

assert.match(backpackPage, /\/v1\/customer\/buyback-quotes\/\$\{quote\.id\}\/accept/, "backpack page must accept buyback quotes through the customer accept endpoint");
assert.match(backpackPage, /isQuoteExpired\(/, "backpack page must detect expired quotes client-side");
assert.match(backpackPage, /disabled=\{acceptBusy \|\| expired\}/, "backpack page must disable quote accept when expired");
assert.match(backpackPage, /loadWallet\(\)/, "backpack page must refresh wallet data after accepting a quote");
assert.doesNotMatch(backpackPage, /cash paid/i, "backpack page must not claim cash payout");
assert.doesNotMatch(backpackPage, /cash quote/i, "backpack page must not label points quote as cash");

assert.match(packPage, /quote card/i, "pack result flow must render quote card details when buyback quote exists");
assert.match(packPage, /buybackPercent/, "pack result flow must surface buyback percent details");
assert.match(packPage, /valueSource/, "pack result flow must surface quote value source");
assert.match(packPage, /valueAsOf/, "pack result flow must surface quote value as-of");
assert.doesNotMatch(packPage, /cash paid/i, "pack result flow must not claim cash payout");

console.log("customer buyback UI contract ok");
