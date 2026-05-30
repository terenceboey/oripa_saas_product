import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const page = readFileSync("apps/web/app/vendor/page.tsx", "utf8");
const sortingPagePath = "apps/web/app/vendor/working/sorting/page.tsx";
assert.equal(existsSync(sortingPagePath), true, "vendor sorting workbench route must exist");
const sortingPage = readFileSync(sortingPagePath, "utf8");

assert.match(page, /type ItemDraft = \{[\s\S]*catalogItemId\?: string;/, "ItemDraft must carry catalogItemId");
assert.match(page, /type Pack = \{[\s\S]*catalogItemId\?: string \| null;/, "loaded Pack prizes must expose catalogItemId");
assert.match(page, /catalogItemId: suggestion\.id/, "applying a catalog suggestion must preserve catalogItemId");
assert.match(page, /catalogItemId: item\.catalogItemId/, "pack submit payload must send catalogItemId");
assert.match(page, /catalogItemId: prize\.catalogItemId \?\? undefined/, "editing a pack must keep catalogItemId on draft rows");
assert.match(page, /\/v1\/catalog\/suggest/, "typeahead must use the lightweight suggest endpoint");
assert.match(page, /\/v1\/catalog\/facets/, "vendor catalog UX must load catalog facets");
assert.match(page, /catalogFilters/, "vendor page must hold catalog filter state");
assert.match(page, /setCatalogFilterInUrl/, "catalog filters must sync into the URL");
assert.match(page, /url\.searchParams\.set\("source", catalogFilters\.source\)/, "typeahead must preserve source filter state");
assert.match(page, /url\.searchParams\.set\("setId", catalogFilters\.setId\)/, "typeahead must preserve set filter state");
assert.match(page, /url\.searchParams\.set\("rarity", catalogFilters\.rarity\)/, "typeahead must preserve rarity filter state");
assert.match(page, /url\.searchParams\.set\("language", catalogFilters\.language\)/, "typeahead must preserve language filter state");
assert.match(sortingPage, /\/v1\/catalog\/search/, "sorting workbench must use catalog search endpoint");
assert.match(sortingPage, /sortMode/, "sorting workbench must expose sort mode state");
assert.match(sortingPage, /estimatedValue/, "sorting workbench must render value-oriented columns for operators");
assert.match(sortingPage, /\/vendor/, "sorting workbench must link back to vendor dashboard");

console.log("vendor catalog UX source probe passed");
