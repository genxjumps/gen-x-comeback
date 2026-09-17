import {
  resolveMigrationComparisonBase,
  verifyMigrationChangesAgainstBase,
  verifyMigrationLock,
} from "./migration-integrity";

const lock = verifyMigrationLock();
const comparisonBase = resolveMigrationComparisonBase();

if (comparisonBase) {
  verifyMigrationChangesAgainstBase(comparisonBase, lock);
}

console.log(
  JSON.stringify(
    {
      comparisonBase,
      latestMigration: lock.migrations.at(-1),
      lockedMigrations: lock.migrations.length,
      status: "migration-integrity-verified",
    },
    null,
    2,
  ),
);
