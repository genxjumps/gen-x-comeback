-- Read-only catalog assertions, reusable after application. No test rows are created.
DO $$
DECLARE t record; f record; r text; privilege text; count_tables integer:=0; count_functions integer:=0;
BEGIN
  FOR t IN SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN
      ('accelerator_refund_requests','accelerator_refund_receipts','private_refund_reviewers')
  LOOP
    count_tables:=count_tables+1;
    IF NOT t.relrowsecurity THEN RAISE EXCEPTION 'RLS missing: %',t.relname; END IF;
    IF EXISTS(SELECT 1 FROM aclexplode(COALESCE(t.relacl,acldefault('r',t.relowner))) a
      WHERE a.grantee<>t.relowner AND
      (a.grantee<>(SELECT oid FROM pg_roles WHERE rolname='service_role')
       OR a.privilege_type NOT IN ('SELECT','INSERT','UPDATE') OR a.is_grantable))
    THEN RAISE EXCEPTION 'Unexpected table grant: %',t.relname; END IF;
    IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=t.oid AND attacl IS NOT NULL)
    THEN RAISE EXCEPTION 'Unexpected column grant: %',t.relname; END IF;
    FOREACH privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE'] LOOP
      IF NOT has_table_privilege('service_role',t.oid,privilege) THEN
        RAISE EXCEPTION 'Runtime permission missing: % %',t.relname,privilege;
      END IF;
    END LOOP;
    FOREACH privilege IN ARRAY ARRAY['DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      IF has_table_privilege('service_role',t.oid,privilege) THEN
        RAISE EXCEPTION 'Excess runtime permission: % %',t.relname,privilege;
      END IF;
    END LOOP;
    FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','sandbox_exec') LOOP
      FOREACH privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
        IF has_table_privilege(r,t.oid,privilege) THEN RAISE EXCEPTION 'Excess access: % % %',r,t.relname,privilege; END IF;
      END LOOP;
    END LOOP;
    IF (SELECT count(*) FROM pg_policy WHERE polrelid=t.oid)<>1 OR NOT EXISTS(
      SELECT 1 FROM pg_policy WHERE polrelid=t.oid AND polname='service_role_only'
      AND polcmd='*' AND polpermissive AND polroles=ARRAY[(SELECT oid FROM pg_roles WHERE rolname='service_role')]
      AND pg_get_expr(polqual,polrelid)='true' AND pg_get_expr(polwithcheck,polrelid)='true'
    ) THEN RAISE EXCEPTION 'Unexpected RLS policy: %',t.relname; END IF;
  END LOOP;
  IF count_tables<>3 THEN RAISE EXCEPTION 'Expected three refund tables'; END IF;
  FOR f IN SELECT p.* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('request_accelerator_refund','get_accelerator_refund_purchases',
      'get_accelerator_refund_queue','confirm_accelerator_full_refund')
  LOOP
    count_functions:=count_functions+1;
    IF NOT f.prosecdef OR f.proconfig IS DISTINCT FROM ARRAY['search_path=public']
      OR NOT has_function_privilege('service_role',f.oid,'EXECUTE') THEN RAISE EXCEPTION 'Unsafe function: %',f.proname; END IF;
    IF EXISTS(SELECT 1 FROM aclexplode(COALESCE(f.proacl,acldefault('f',f.proowner))) a
      WHERE a.grantee<>f.proowner AND
      (a.grantee<>(SELECT oid FROM pg_roles WHERE rolname='service_role') OR a.is_grantable))
    THEN RAISE EXCEPTION 'Unexpected function grant: %',f.proname; END IF;
    FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','sandbox_exec') LOOP
      IF has_function_privilege(r,f.oid,'EXECUTE') THEN RAISE EXCEPTION 'Excess RPC access: % %',r,f.proname; END IF;
    END LOOP;
  END LOOP;
  IF count_functions<>4 THEN RAISE EXCEPTION 'Expected four refund functions'; END IF;
END $$;
