-- Remove inherited Cloud defaults from refund objects only. Existing history is immutable.
-- Database owners retain administration; runtime access is explicitly service-role-only.
DO $$
DECLARE target record; permission record;
BEGIN
  IF to_regclass('public.accelerator_refund_requests') IS NULL
    OR to_regclass('public.accelerator_refund_receipts') IS NULL
    OR to_regclass('public.private_refund_reviewers') IS NULL THEN
    RAISE EXCEPTION 'Refund foundation must be applied first';
  END IF;
  FOR target IN
    SELECT c.oid, c.relname, c.relowner FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN
      ('accelerator_refund_requests','accelerator_refund_receipts','private_refund_reviewers')
  LOOP
    FOR permission IN
      SELECT DISTINCT acl.grantee FROM aclexplode(COALESCE(
        (SELECT relacl FROM pg_class WHERE oid=target.oid), acldefault('r',target.relowner)
      )) acl WHERE acl.grantee<>target.relowner
    LOOP
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %s',target.relname,
        CASE WHEN permission.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(permission.grantee)) END);
    END LOOP;
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE public.%I TO service_role',target.relname);
  END LOOP;

  FOR target IN
    SELECT p.oid, p.proowner, p.proacl, p.oid::regprocedure AS signature FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN
      ('request_accelerator_refund','get_accelerator_refund_purchases',
       'get_accelerator_refund_queue','confirm_accelerator_full_refund')
  LOOP
    FOR permission IN
      SELECT DISTINCT acl.grantee FROM aclexplode(COALESCE(target.proacl,acldefault('f',target.proowner))) acl
      WHERE acl.grantee<>target.proowner
    LOOP
      EXECUTE format('REVOKE ALL PRIVILEGES ON FUNCTION %s FROM %s',target.signature,
        CASE WHEN permission.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(permission.grantee)) END);
    END LOOP;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',target.signature);
  END LOOP;
END $$;
