import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { config as loadDotenv } from "dotenv";

type EnvLike = Record<string, string | undefined>;

type PackageJsonLike = {
  scripts?: Record<string, string>;
};

const REPO_ROOT = path.resolve(__dirname, "../../..");
const API_PACKAGE_JSON = path.resolve(__dirname, "../package.json");
const LOCAL_TEST_DATABASE_URL = "postgresql://oripa_backend_tests:invalid@127.0.0.1:1/oripa_backend_tests";
const EXCLUDED_TEST_SCRIPT_NAMES = new Set([
  "test",
  "test:db:apply",
  "test:db:migrate",
  "test:db:seed",
  "test:prod",
  "test:production",
]);

function parseHostFromDatabaseUrl(databaseUrl: string): string {
  try {
    return new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    return databaseUrl.toLowerCase();
  }
}

export function isUnsafeHostedDatabaseUrl(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) return false;
  const lowered = databaseUrl.toLowerCase();
  const host = parseHostFromDatabaseUrl(databaseUrl);

  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
  if (lowered.startsWith("file:") || lowered.startsWith("sqlite:")) return false;

  return (
    host.includes("render.com") ||
    lowered.includes("render.com") ||
    lowered.includes("oripa_sg") ||
    (lowered.includes("sslmode=require") && !host.endsWith(".local") && host !== "")
  );
}

export function assertSafeBackendTestEnvironment(env: EnvLike): void {
  if (env.NODE_ENV !== "test") {
    throw new Error("Refusing to run backend tests unless NODE_ENV=test");
  }

  if (isUnsafeHostedDatabaseUrl(env.DATABASE_URL)) {
    throw new Error(
      "Refusing to run backend tests with hosted/live DATABASE_URL. Use local/in-memory mocks or a local test database.",
    );
  }
}

export function getBackendTargetedTestScripts(packageJson: PackageJsonLike): string[] {
  return Object.keys(packageJson.scripts ?? {})
    .filter((name) => name.startsWith("test:"))
    .filter((name) => !EXCLUDED_TEST_SCRIPT_NAMES.has(name))
    .filter((name) => !name.includes(":apply") && !name.includes(":migrate") && !name.includes(":seed"))
    .sort();
}

function readApiPackageJson(): PackageJsonLike {
  return JSON.parse(fs.readFileSync(API_PACKAGE_JSON, "utf8"));
}

function readDotenvDatabaseUrls(): string[] {
  const dotenvPaths = [path.resolve(REPO_ROOT, ".env"), path.resolve(REPO_ROOT, "apps/api/.env")];
  const values: string[] = [];
  for (const dotenvPath of dotenvPaths) {
    if (!fs.existsSync(dotenvPath)) continue;
    const parsed = loadDotenv({ path: dotenvPath, override: false }).parsed;
    if (parsed?.DATABASE_URL) values.push(parsed.DATABASE_URL);
  }
  return values;
}

export function runBackendTargetedTests(): number {
  if (isUnsafeHostedDatabaseUrl(process.env.DATABASE_URL)) {
    assertSafeBackendTestEnvironment({ ...process.env, NODE_ENV: "test" });
  }

  const unsafeDotenvDatabaseUrl = readDotenvDatabaseUrls().some(isUnsafeHostedDatabaseUrl);
  if (unsafeDotenvDatabaseUrl) {
    console.log("[backend-test-harness] unsafe hosted DATABASE_URL found in .env; ignoring it for pure/mocked backend tests");
  }

  assertSafeBackendTestEnvironment({ ...process.env, NODE_ENV: "test", DATABASE_URL: LOCAL_TEST_DATABASE_URL });

  const packageJson = readApiPackageJson();
  const testScripts = getBackendTargetedTestScripts(packageJson);
  if (testScripts.length === 0) {
    throw new Error("No backend targeted test scripts found in apps/api/package.json");
  }

  console.log(`[backend-test-harness] running ${testScripts.length} targeted backend test scripts`);
  console.log("[backend-test-harness] DATABASE_URL is replaced with a local fail-fast test URL for child tests");

  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "test",
    ORIPA_BACKEND_TEST_MODE: "1",
    DATABASE_URL: LOCAL_TEST_DATABASE_URL,
  };

  for (const scriptName of testScripts) {
    console.log(`\n[backend-test-harness] npm run ${scriptName} -w @oripa/api`);
    const result = spawnSync("npm", ["run", scriptName, "-w", "@oripa/api"], {
      cwd: REPO_ROOT,
      env: childEnv,
      stdio: "inherit",
      shell: false,
    });

    if (result.error) {
      console.error(`[backend-test-harness] failed to spawn ${scriptName}:`, result.error);
      return 1;
    }
    if (result.status !== 0) {
      console.error(`[backend-test-harness] ${scriptName} failed with exit code ${result.status}`);
      return result.status ?? 1;
    }
  }

  console.log("\n[backend-test-harness] all targeted backend tests passed");
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = runBackendTargetedTests();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
