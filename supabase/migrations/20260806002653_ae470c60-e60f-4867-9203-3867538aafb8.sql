-- Ledger metadata reconciliation only. No public schema DDL, no data changes.
-- Re-labels the duplicate-identifier rows recorded for the two canonical
-- August 4 Start Day 1 migrations so the repository chain is replayable.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
     WHERE version = '20260806001556' AND name = '9d782eff-6e78-4e0a-894c-6ca3121d570e'
  ) AND NOT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20260804000000'
  ) THEN
    UPDATE supabase_migrations.schema_migrations
       SET version = '20260804000000',
           name = 'start_day_1_job_foundation',
           statements = ARRAY[statements[1] || E'\n']
     WHERE version = '20260806001556'
       AND name = '9d782eff-6e78-4e0a-894c-6ca3121d570e';
  END IF;

  IF EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
     WHERE version = '20260806001649' AND name = '4aa3b1ed-d379-4997-9abf-18304c5d99bf'
  ) AND NOT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20260804010000'
  ) THEN
    UPDATE supabase_migrations.schema_migrations
       SET version = '20260804010000',
           name = 'day_1_start_state',
           statements = ARRAY[statements[1] || E'\n']
     WHERE version = '20260806001649'
       AND name = '4aa3b1ed-d379-4997-9abf-18304c5d99bf';
  END IF;
END $$;