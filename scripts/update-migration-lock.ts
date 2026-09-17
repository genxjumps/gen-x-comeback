import { writeFileSync } from "node:fs";

import {
  createOrExtendMigrationLock,
  migrationLockPath,
  serializeMigrationLock,
} from "./migration-integrity";

const lock = createOrExtendMigrationLock();

writeFileSync(migrationLockPath, serializeMigrationLock(lock));
console.log(`[migration] Locked ${lock.migrations.length} migrations in ${migrationLockPath}.`);
