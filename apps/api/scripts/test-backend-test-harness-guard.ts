import assert from "node:assert/strict";
import {
  assertSafeBackendTestEnvironment,
  getBackendTargetedTestScripts,
  isUnsafeHostedDatabaseUrl,
} from "./backend-test-harness";

assert.equal(isUnsafeHostedDatabaseUrl(undefined), false);
assert.equal(isUnsafeHostedDatabaseUrl(""), false);
assert.equal(isUnsafeHostedDatabaseUrl("postgresql://oripa:test@127.0.0.1:5432/oripa_test"), false);
assert.equal(isUnsafeHostedDatabaseUrl("postgresql://oripa:test@localhost:5432/oripa_test"), false);
assert.equal(
  isUnsafeHostedDatabaseUrl("postgresql://user:pass@dpg-example-a.singapore-postgres.render.com/oripa_sg?sslmode=require"),
  true,
);
assert.equal(isUnsafeHostedDatabaseUrl("postgresql://user:pass@aws.render.com/oripa_sg"), true);
assert.equal(isUnsafeHostedDatabaseUrl("postgresql://user:pass@example.com/oripa_sg?sslmode=require"), true);

assert.doesNotThrow(() =>
  assertSafeBackendTestEnvironment({
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://oripa:test@127.0.0.1:5432/oripa_test",
  }),
);

assert.throws(
  () =>
    assertSafeBackendTestEnvironment({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://oripa:test@127.0.0.1:5432/oripa_test",
    }),
  /NODE_ENV=test/,
);

assert.throws(
  () =>
    assertSafeBackendTestEnvironment({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://user:pass@dpg-example-a.singapore-postgres.render.com/oripa_sg?sslmode=require",
    }),
  /Refusing to run backend tests with hosted\/live DATABASE_URL/,
);

const packageJson = {
  scripts: {
    test: "tsx scripts/run-backend-tests.ts",
    "test:z": "tsx scripts/test-z.ts",
    "test:a": "tsx scripts/test-a.ts",
    "test:db:apply": "tsx scripts/test-db-apply.ts",
    lint: "tsc --noEmit",
  },
};
assert.deepEqual(getBackendTargetedTestScripts(packageJson), ["test:a", "test:z"]);

console.log("backend test harness guard ok");
