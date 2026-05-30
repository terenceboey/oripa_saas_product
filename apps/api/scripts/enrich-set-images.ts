import { prisma } from "../src/lib/prisma";

type PokemonTcgSet = {
  id?: string;
  name?: string;
  ptcgoCode?: string;
  images?: {
    symbol?: string;
    logo?: string;
  };
};

type BulbapediaSearchPayload = {
  query?: {
    search?: Array<{ title: string }>;
  };
};

type BulbapediaPageImagePayload = {
  query?: {
    pages?: Record<
      string,
      {
        pageid?: number;
        title?: string;
        thumbnail?: { source?: string };
      }
    >;
  };
};

const POKEMON_TCG_BASE_URL = "https://api.pokemontcg.io/v2/sets";
const BULBAPEDIA_API_URL = "https://bulbapedia.bulbagarden.net/w/api.php";
const REQUEST_DELAY_MS = Math.max(20, Number(process.env.SET_IMAGE_REQUEST_DELAY_MS ?? "120"));
const MAX_SETS = Math.max(0, Number(process.env.SET_IMAGE_MAX_SETS ?? "0"));
const FORCE_REPLACE = process.env.SET_IMAGE_FORCE_REPLACE === "true";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizeImageFromBulbapedia(source: string | null) {
  if (!source) return null;
  // Prefer a smaller, cacheable thumbnail while keeping quality.
  return source.replace(/\/\d+px-/, "/800px-");
}

function looksLikeSetLogoUrl(url: string | null) {
  if (!url) return false;
  return /logo|set[_\-\s]?symbol|symbol|boxart|trainer[_\-\s]?kit|promo/i.test(url);
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenJaccard(a: string, b: string) {
  const sa = new Set(normalizeName(a).split(" ").filter(Boolean));
  const sb = new Set(normalizeName(b).split(" ").filter(Boolean));
  if (!sa.size || !sb.size) return 0;
  let intersection = 0;
  for (const token of sa) if (sb.has(token)) intersection += 1;
  const union = sa.size + sb.size - intersection;
  return union > 0 ? intersection / union : 0;
}

async function fetchPokemonTcgSetByCodeOrName(input: { setCode?: string | null; name: string }) {
  const byNameUrl = new URL(POKEMON_TCG_BASE_URL);
  byNameUrl.searchParams.set("q", `name:${JSON.stringify(input.name)}`);
  byNameUrl.searchParams.set("pageSize", "5");
  byNameUrl.searchParams.set("select", "id,name,ptcgoCode,images");
  const byNameRes = await fetch(byNameUrl.toString(), { headers: { accept: "application/json" } });
  if (byNameRes.ok) {
    const payload = (await byNameRes.json()) as { data?: PokemonTcgSet[] };
    const candidates = payload.data ?? [];
    const exact = candidates.find((c) => normalizeName(c.name ?? "") === normalizeName(input.name));
    if (exact?.images?.logo || exact?.images?.symbol) return exact;
    const best = candidates
      .map((c) => ({ c, score: tokenJaccard(c.name ?? "", input.name) }))
      .sort((a, b) => b.score - a.score)[0];
    if (best && best.score >= 0.75 && (best.c.images?.logo || best.c.images?.symbol)) {
      return best.c;
    }
  }
  await sleep(REQUEST_DELAY_MS);

  const code = asString(input.setCode);
  const isAmbiguousCode = !!code && ["PR", "POP"].includes(code.toUpperCase());
  if (!code || isAmbiguousCode) return null;

  const filters: string[] = [`ptcgoCode:${JSON.stringify(code)}`, `id:${JSON.stringify(code)}`];
  for (const filter of filters) {
    const url = new URL(POKEMON_TCG_BASE_URL);
    url.searchParams.set("q", filter);
    url.searchParams.set("pageSize", "5");
    url.searchParams.set("select", "id,name,ptcgoCode,images");
    const response = await fetch(url.toString(), {
      headers: { accept: "application/json" },
    });
    if (!response.ok) continue;
    const payload = (await response.json()) as { data?: PokemonTcgSet[] };
    const candidates = payload.data ?? [];
    const best = candidates
      .map((c) => ({ c, score: tokenJaccard(c.name ?? "", input.name) }))
      .sort((a, b) => b.score - a.score)[0];
    if (best && best.score >= 0.5 && (best.c.images?.logo || best.c.images?.symbol)) {
      return best.c;
    }
    const candidate = candidates[0];
    if (candidate && tokenJaccard(candidate.name ?? "", input.name) >= 0.8 && (candidate.images?.logo || candidate.images?.symbol)) {
      return candidate;
    }
    await sleep(REQUEST_DELAY_MS);
  }

  return null;
}

async function fetchBulbapediaLogoBySetName(name: string) {
  const queries = [`${name} (TCG)`, `${name} Pokémon Trading Card Game`, name];
  for (const query of queries) {
    const searchUrl = new URL(BULBAPEDIA_API_URL);
    searchUrl.searchParams.set("action", "query");
    searchUrl.searchParams.set("list", "search");
    searchUrl.searchParams.set("srsearch", query);
    searchUrl.searchParams.set("format", "json");
    searchUrl.searchParams.set("origin", "*");
    const searchRes = await fetch(searchUrl.toString());
    if (!searchRes.ok) continue;
    const searchPayload = (await searchRes.json()) as BulbapediaSearchPayload;
    const title = searchPayload.query?.search?.[0]?.title;
    if (!title) continue;

    const pageImageUrl = new URL(BULBAPEDIA_API_URL);
    pageImageUrl.searchParams.set("action", "query");
    pageImageUrl.searchParams.set("prop", "pageimages");
    pageImageUrl.searchParams.set("piprop", "thumbnail");
    pageImageUrl.searchParams.set("pithumbsize", "900");
    pageImageUrl.searchParams.set("titles", title);
    pageImageUrl.searchParams.set("format", "json");
    pageImageUrl.searchParams.set("origin", "*");
    const imageRes = await fetch(pageImageUrl.toString());
    if (!imageRes.ok) continue;
    const imagePayload = (await imageRes.json()) as BulbapediaPageImagePayload;
    const pages = imagePayload.query?.pages ?? {};
    const firstPage = Object.values(pages)[0];
    const source = normalizeImageFromBulbapedia(asString(firstPage?.thumbnail?.source));
    if (source && looksLikeSetLogoUrl(source)) return source;
    await sleep(REQUEST_DELAY_MS);
  }
  return null;
}

async function main() {
  const startedAt = Date.now();
  const sets = await prisma.catalogSet.findMany({
    where: {
      game: { in: ["POKEMON", "POKEMON_JAPAN"] },
      isActive: true,
    },
    orderBy: [{ game: "asc" }, { releaseDate: "desc" }, { name: "asc" }],
    ...(MAX_SETS > 0 ? { take: MAX_SETS } : {}),
    select: {
      id: true,
      game: true,
      name: true,
      setCode: true,
      logoImageUrl: true,
      symbolImageUrl: true,
    },
  });

  let updated = 0;
  let matchedPokemonApi = 0;
  let matchedBulbapedia = 0;
  let skipped = 0;

  for (const set of sets) {
    const hasGoodLogo = asString(set.logoImageUrl);
    if (hasGoodLogo && !FORCE_REPLACE) {
      skipped += 1;
      continue;
    }

    let nextLogo: string | null = null;
    let nextSymbol = asString(set.symbolImageUrl);

    if (set.game === "POKEMON") {
      const pokemonApiSet = await fetchPokemonTcgSetByCodeOrName({ setCode: set.setCode, name: set.name });
      if (pokemonApiSet?.images?.logo || pokemonApiSet?.images?.symbol) {
        nextLogo = asString(pokemonApiSet.images?.logo);
        nextSymbol = asString(pokemonApiSet.images?.symbol) ?? nextSymbol;
        matchedPokemonApi += 1;
      }
    }

    if (!nextLogo) {
      nextLogo = await fetchBulbapediaLogoBySetName(set.name);
      if (nextLogo) matchedBulbapedia += 1;
    }

    if (!nextLogo && !nextSymbol) {
      continue;
    }

    const existingLogo = asString(set.logoImageUrl);
    const existingLogoLooksWrong =
      !!existingLogo &&
      existingLogo.includes("archives.bulbagarden.net") &&
      !looksLikeSetLogoUrl(existingLogo);

    const finalLogo = nextLogo ?? (existingLogoLooksWrong ? nextSymbol : existingLogo) ?? null;

    await prisma.catalogSet.update({
      where: { id: set.id },
      data: {
        logoImageUrl: finalLogo,
        symbolImageUrl: nextSymbol,
      },
    });
    updated += 1;
    await sleep(REQUEST_DELAY_MS);
  }

  const durationSec = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `[set-image-enrich] completed updated=${updated} skipped=${skipped} pokemonApi=${matchedPokemonApi} bulbapedia=${matchedBulbapedia} duration=${durationSec}s`,
  );
}

main()
  .catch((error) => {
    console.error("[set-image-enrich] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
