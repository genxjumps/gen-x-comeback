import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

export const migrationDirectory = "supabase/migrations";
export const migrationLockPath = "supabase/migration-lock.json";

const fullSha256 = /^[0-9a-f]{64}$/;
const migrationFilePattern = /^(\d{14})_([a-z0-9][a-z0-9_-]*)\.sql$/;

export type MigrationRecord = {
  file: string;
  name: string;
  sha256: string;
  statementSha256: string;
  version: string;
};

export type MigrationLock = {
  migrations: Array<MigrationRecord>;
  version: 1;
};

export type MigrationChange = {
  paths: Array<string>;
  status: string;
};

function sha256(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function stripOneTrailingNewline(content: Buffer): Buffer {
  if (content.length >= 2 && content.at(-2) === 13 && content.at(-1) === 10) {
    return content.subarray(0, -2);
  }

  return content.at(-1) === 10 ? content.subarray(0, -1) : content;
}

export function parseMigrationFile(file: string): { name: string; version: string } {
  const match = migrationFilePattern.exec(file);

  if (!match) {
    throw new Error(
      `Migration ${file} must use the format YYYYMMDDHHMMSS_lowercase_description.sql.`,
    );
  }

  return { name: match[2], version: match[1] };
}

function validateRecord(record: MigrationRecord): void {
  const parsed = parseMigrationFile(record.file);

  if (parsed.version !== record.version || parsed.name !== record.name) {
    throw new Error(`Migration lock metadata does not match ${record.file}.`);
  }

  if (!fullSha256.test(record.sha256) || !fullSha256.test(record.statementSha256)) {
    throw new Error(`Migration lock contains an invalid digest for ${record.file}.`);
  }
}

export function validateMigrationLock(value: unknown): MigrationLock {
  if (!value || typeof value !== "object") {
    throw new Error("The migration lock is missing or invalid.");
  }

  const lock = value as Partial<MigrationLock>;

  if (lock.version !== 1 || !Array.isArray(lock.migrations) || lock.migrations.length === 0) {
    throw new Error("The migration lock is missing or invalid.");
  }

  const versions = new Set<string>();
  const files = new Set<string>();

  for (const migration of lock.migrations) {
    validateRecord(migration);

    if (versions.has(migration.version) || files.has(migration.file)) {
      throw new Error("The migration lock contains a duplicate version or filename.");
    }

    versions.add(migration.version);
    files.add(migration.file);
  }

  const sorted = [...lock.migrations].sort((left, right) => left.file.localeCompare(right.file));

  if (JSON.stringify(sorted) !== JSON.stringify(lock.migrations)) {
    throw new Error("The migration lock must be sorted by filename.");
  }

  return lock as MigrationLock;
}

export function serializeMigrationLock(lock: MigrationLock): string {
  validateMigrationLock(lock);
  return `${JSON.stringify(lock, null, 2)}\n`;
}

export function readMigrationRecords(
  rootDirectory: string = process.cwd(),
): Array<MigrationRecord> {
  const directory = resolve(rootDirectory, migrationDirectory);
  const files = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();

  const migrations = files.map((file) => {
    const parsed = parseMigrationFile(file);
    const content = readFileSync(resolve(directory, file));

    return {
      file,
      name: parsed.name,
      sha256: sha256(content),
      statementSha256: sha256(stripOneTrailingNewline(content)),
      version: parsed.version,
    };
  });

  const versions = migrations.map((migration) => migration.version);

  if (new Set(versions).size !== versions.length) {
    throw new Error("Migration filenames contain duplicate versions.");
  }

  return migrations;
}

export function readMigrationLock(rootDirectory: string = process.cwd()): MigrationLock {
  const path = resolve(rootDirectory, migrationLockPath);
  return validateMigrationLock(JSON.parse(readFileSync(path, "utf8")) as unknown);
}

export function assertLockExtends(base: MigrationLock, current: MigrationLock): void {
  if (current.migrations.length < base.migrations.length) {
    throw new Error("The migration lock cannot remove historical migrations.");
  }

  for (const [index, migration] of base.migrations.entries()) {
    if (JSON.stringify(current.migrations[index]) !== JSON.stringify(migration)) {
      throw new Error(`The locked historical migration ${migration.file} cannot change.`);
    }
  }
}

export function createOrExtendMigrationLock(rootDirectory: string = process.cwd()): MigrationLock {
  const records = readMigrationRecords(rootDirectory);
  const lockFile = resolve(rootDirectory, migrationLockPath);

  if (!existsSync(lockFile)) {
    return { migrations: records, version: 1 };
  }

  const existing = readMigrationLock(rootDirectory);
  const currentByFile = new Map(records.map((record) => [record.file, record]));

  for (const migration of existing.migrations) {
    const current = currentByFile.get(migration.file);

    if (!current) {
      throw new Error(`Locked historical migration ${migration.file} cannot be deleted.`);
    }

    if (JSON.stringify(current) !== JSON.stringify(migration)) {
      throw new Error(`Locked historical migration ${migration.file} cannot be modified.`);
    }
  }

  const lockedFiles = new Set(existing.migrations.map((migration) => migration.file));
  const additions = records.filter((record) => !lockedFiles.has(record.file));
  const latestLockedVersion = existing.migrations.at(-1)?.version ?? "00000000000000";

  for (const migration of additions) {
    if (migration.version <= latestLockedVersion) {
      throw new Error(
        `New migration ${migration.file} must sort after locked version ${latestLockedVersion}.`,
      );
    }
  }

  return {
    migrations: [...existing.migrations, ...additions],
    version: 1,
  };
}

export function verifyMigrationLock(rootDirectory: string = process.cwd()): MigrationLock {
  const lock = readMigrationLock(rootDirectory);
  const records = readMigrationRecords(rootDirectory);

  if (JSON.stringify(lock.migrations) !== JSON.stringify(records)) {
    throw new Error(
      "The migration lock does not match supabase/migrations. Historical migrations are immutable; run migration:lock only after adding a new migration.",
    );
  }

  return lock;
}

export function parseMigrationChanges(output: string): Array<MigrationChange> {
  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [status, ...paths] = line.split("\t");
      return { paths, status };
    });
}

export function assertOnlyAdditiveMigrationChanges(changes: Array<MigrationChange>): void {
  for (const change of changes) {
    if (change.status !== "A" || change.paths.length !== 1) {
      throw new Error(
        `Historical migration change rejected: ${change.status} ${change.paths.join(" -> ")}.`,
      );
    }

    parseMigrationFile(change.paths[0].replace(`${migrationDirectory}/`, ""));
  }
}

function runGit(arguments_: Array<string>, rootDirectory: string): string {
  return execFileSync("git", arguments_, {
    cwd: rootDirectory,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function readLockAtGitRef(baseRef: string, rootDirectory: string): MigrationLock | null {
  const path = runGit(["ls-tree", "--name-only", baseRef, "--", migrationLockPath], rootDirectory);

  if (!path) return null;

  return validateMigrationLock(
    JSON.parse(runGit(["show", `${baseRef}:${migrationLockPath}`], rootDirectory)) as unknown,
  );
}

export function verifyMigrationChangesAgainstBase(
  baseRef: string,
  currentLock: MigrationLock,
  rootDirectory: string = process.cwd(),
): void {
  runGit(["rev-parse", "--verify", baseRef], rootDirectory);

  const changes = parseMigrationChanges(
    runGit(
      ["diff", "--name-status", "--find-renames", `${baseRef}...HEAD`, "--", migrationDirectory],
      rootDirectory,
    ),
  );
  const baseLock = readLockAtGitRef(baseRef, rootDirectory);

  if (!baseLock) {
    if (changes.length > 0) {
      throw new Error("The initial migration-lock checkpoint cannot also change migration SQL.");
    }

    return;
  }

  assertLockExtends(baseLock, currentLock);
  assertOnlyAdditiveMigrationChanges(changes);

  const latestBaseVersion = baseLock.migrations.at(-1)?.version ?? "00000000000000";
  const additions = currentLock.migrations.slice(baseLock.migrations.length);

  for (const migration of additions) {
    if (migration.version <= latestBaseVersion) {
      throw new Error(
        `New migration ${migration.file} must sort after locked version ${latestBaseVersion}.`,
      );
    }
  }
}

export function resolveMigrationComparisonBase(
  environment: NodeJS.ProcessEnv = process.env,
): string | null {
  if (environment.MIGRATION_BASE_REF?.trim()) {
    return environment.MIGRATION_BASE_REF.trim();
  }

  if (environment.GITHUB_EVENT_NAME === "pull_request" && environment.GITHUB_BASE_REF?.trim()) {
    return `origin/${environment.GITHUB_BASE_REF.trim()}`;
  }

  if (environment.GITHUB_EVENT_NAME === "push") {
    return "HEAD^1";
  }

  return null;
}
