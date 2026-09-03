import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertLockExtends,
  assertOnlyAdditiveMigrationChanges,
  createOrExtendMigrationLock,
  migrationLockPath,
  parseMigrationFile,
  resolveMigrationComparisonBase,
  serializeMigrationLock,
  verifyMigrationLock,
  type MigrationLock,
} from "../../../scripts/migration-integrity";

function createRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "migration-integrity-"));
  mkdirSync(join(root, "supabase", "migrations"), { recursive: true });
  return root;
}

function writeMigration(root: string, file: string, sql: string): void {
  writeFileSync(join(root, "supabase", "migrations", file), sql);
}

function writeLock(root: string, lock: MigrationLock): void {
  writeFileSync(join(root, migrationLockPath), serializeMigrationLock(lock));
}

describe("migration integrity", () => {
  it("creates a deterministic lock with exact and statement-level digests", () => {
    const root = createRoot();
    writeMigration(root, "20260101000000_first_change.sql", "select 1;\n");
    writeMigration(root, "20260102000000_second_change.sql", "select 2;");

    const lock = createOrExtendMigrationLock(root);

    expect(lock.migrations.map((migration) => migration.version)).toEqual([
      "20260101000000",
      "20260102000000",
    ]);
    expect(lock.migrations[0].sha256).not.toBe(lock.migrations[0].statementSha256);
    expect(lock.migrations[1].sha256).toBe(lock.migrations[1].statementSha256);
  });

  it("verifies an unchanged lock and rejects modified history", () => {
    const root = createRoot();
    const file = "20260101000000_first_change.sql";
    writeMigration(root, file, "select 1;\n");
    writeLock(root, createOrExtendMigrationLock(root));

    expect(verifyMigrationLock(root).migrations).toHaveLength(1);

    writeMigration(root, file, "select 2;\n");
    expect(() => verifyMigrationLock(root)).toThrow("Historical migrations are immutable");
    expect(() => createOrExtendMigrationLock(root)).toThrow("cannot be modified");
  });

  it("rejects deletion of a locked historical migration", () => {
    const root = createRoot();
    const file = "20260101000000_first_change.sql";
    writeMigration(root, file, "select 1;\n");
    writeLock(root, createOrExtendMigrationLock(root));
    rmSync(join(root, "supabase", "migrations", file));

    expect(() => createOrExtendMigrationLock(root)).toThrow("cannot be deleted");
  });

  it("extends the lock only with migrations newer than all locked history", () => {
    const root = createRoot();
    writeMigration(root, "20260102000000_existing.sql", "select 1;");
    writeLock(root, createOrExtendMigrationLock(root));
    writeMigration(root, "20260103000000_new_change.sql", "select 2;");

    const extended = createOrExtendMigrationLock(root);
    expect(extended.migrations).toHaveLength(2);

    writeMigration(root, "20260101000000_backdated.sql", "select 0;");
    expect(() => createOrExtendMigrationLock(root)).toThrow("must sort after locked version");
  });

  it("requires the current lock to preserve every base entry exactly", () => {
    const root = createRoot();
    writeMigration(root, "20260101000000_existing.sql", "select 1;");
    const base = createOrExtendMigrationLock(root);
    const changed = structuredClone(base);
    changed.migrations[0].sha256 = "a".repeat(64);

    expect(() => assertLockExtends(base, changed)).toThrow("cannot change");
    expect(() => assertLockExtends(base, { migrations: [], version: 1 })).toThrow("cannot remove");
  });

  it("allows only added migration files in a branch diff", () => {
    expect(() =>
      assertOnlyAdditiveMigrationChanges([
        {
          paths: ["supabase/migrations/20260102000000_new_change.sql"],
          status: "A",
        },
      ]),
    ).not.toThrow();
    expect(() =>
      assertOnlyAdditiveMigrationChanges([
        {
          paths: ["supabase/migrations/20260101000000_existing.sql"],
          status: "M",
        },
      ]),
    ).toThrow("Historical migration change rejected");
    expect(() =>
      assertOnlyAdditiveMigrationChanges([
        {
          paths: [
            "supabase/migrations/20260101000000_existing.sql",
            "supabase/migrations/20260102000000_renamed.sql",
          ],
          status: "R100",
        },
      ]),
    ).toThrow("Historical migration change rejected");
  });

  it("rejects malformed migration names and resolves CI comparison refs", () => {
    expect(() => parseMigrationFile("bad.sql")).toThrow("must use the format");
    expect(
      resolveMigrationComparisonBase({
        GITHUB_BASE_REF: "release/v1.1",
        GITHUB_EVENT_NAME: "pull_request",
      }),
    ).toBe("origin/release/v1.1");
    expect(resolveMigrationComparisonBase({ GITHUB_EVENT_NAME: "push" })).toBe("HEAD^1");
    expect(resolveMigrationComparisonBase({ MIGRATION_BASE_REF: "origin/main" })).toBe(
      "origin/main",
    );
  });
});
