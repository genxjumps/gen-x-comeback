// Isolated database replay and generated refund capability types. No remote URL accepted.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { format } from "prettier";
async function verifyDatabase(hostedDefaults) {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE sandbox_exec BYPASSRLS;
CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements text[]);
CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA cron; CREATE TABLE cron.job(jobid bigint,jobname text); CREATE SCHEMA net; CREATE SCHEMA vault;
CREATE TABLE vault.secrets(id uuid,name text); CREATE TABLE vault.decrypted_secrets(id uuid,name text,decrypted_secret text);`);
    if (hostedDefaults)
      await db.exec(`
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT ON TABLES TO sandbox_exec;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;
`);
    for (const file of readdirSync("supabase/migrations").sort()) {
      await db.exec(
        readFileSync("supabase/migrations/" + file, "utf8").replace(
          /CREATE EXTENSION IF NOT EXISTS pg_(cron|net);/g,
          "",
        ),
      );
      // Regression control: the original migration must expose the observed Cloud
      // defaults before the forward fix. A weakened fixture must fail this test.
      if (hostedDefaults && file === "20260910100000_accelerator_refund_requests.sql") {
        const [{ service_delete, sandbox_insert }] = (
          await db.query(`SELECT
has_table_privilege('service_role','public.accelerator_refund_receipts','DELETE') AS service_delete,
has_table_privilege('sandbox_exec','public.private_refund_reviewers','INSERT') AS sandbox_insert`)
        ).rows;
        if (!service_delete || !sandbox_insert)
          throw Error("Hosted-default regression fixture is ineffective");
      }
    }
    await db.exec(readFileSync("supabase/accelerator-refunds.permissions.sql", "utf8"));
    await db.exec(readFileSync("supabase/account-recovery.acceptance.sql", "utf8"));
    const recoveryFunctions = [
      "enqueue_paid_access_job",
      "request_customer_access_recovery",
      "claim_production_paid_access_email_jobs",
      "begin_production_paid_access_provider_attempt",
    ];
    const unsafeRecovery = (
      await db.query(
        `SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace
      AND proname=ANY($1) AND (NOT prosecdef OR NOT ('search_path=public'=ANY(proconfig))
      OR has_function_privilege('anon',oid,'EXECUTE') OR has_function_privilege('authenticated',oid,'EXECUTE'))`,
        [recoveryFunctions],
      )
    ).rows;
    if (unsafeRecovery.length) throw Error("Unsafe account recovery capability");
    // Regenerate only the changed column declarations from the replayed catalog.
    const nullableRecovery = (
      await db.query(`SELECT table_name,is_nullable FROM information_schema.columns
      WHERE table_schema='public' AND table_name IN ('paid_access_tokens','paid_access_email_jobs')
      AND column_name='entitlement_id'`)
    ).rows;
    const databaseTypesPath = "src/integrations/supabase/types.ts";
    const existingTypes = readFileSync(databaseTypesPath, "utf8");
    let recoveryTypes = existingTypes;
    for (const column of nullableRecovery) {
      const start = recoveryTypes.indexOf("      " + column.table_name + ": {");
      const end = recoveryTypes.indexOf("        Relationships:", start);
      const section = recoveryTypes
        .slice(start, end)
        .replace(
          /entitlement_id(\??): string(?: \| null)?;/g,
          (_, optional) =>
            "entitlement_id" +
            optional +
            ": string" +
            (column.is_nullable === "YES" ? " | null" : "") +
            ";",
        );
      recoveryTypes = recoveryTypes.slice(0, start) + section + recoveryTypes.slice(end);
    }
    if (nullableRecovery.length !== 2) throw Error("Missing recovery schema columns");
    if (process.argv.includes("--types")) writeFileSync(databaseTypesPath, recoveryTypes);
    else if (recoveryTypes !== existingTypes) throw Error("Recovery types differ from schema");
    const names = [
      "request_accelerator_refund",
      "get_accelerator_refund_purchases",
      "get_accelerator_refund_queue",
      "confirm_accelerator_full_refund",
    ];
    const functions = (
      await db.query(
        `SELECT p.proname,p.proargnames,p.proargtypes::oid[] AS types,p.prosecdef,p.proconfig,
has_function_privilege('anon',p.oid,'EXECUTE') AS anon,has_function_privilege('authenticated',p.oid,'EXECUTE') AS auth
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=ANY($1) ORDER BY p.proname`,
        [names],
      )
    ).rows;
    if (
      functions.length !== names.length ||
      functions.some(
        (f) => !f.prosecdef || !f.proconfig.includes("search_path=public") || f.anon || f.auth,
      )
    )
      throw Error("Unsafe refund capability");
    const pgTypes = (await db.query("SELECT oid,typname FROM pg_type")).rows;
    const tsType = (oid) => {
      const n = pgTypes.find((t) => t.oid === oid)?.typname;
      if (["uuid", "text"].includes(n)) return "string";
      if (n === "_text") return "string[]";
      if (n === "int4") return "number";
      throw Error("Unknown type " + n);
    };
    const generated = await format(
      "// Generated by bun run refunds:db:types from isolated migration replay.\nexport type RefundRpcArgs = {\n" +
        functions
          .map(
            (f) =>
              `${f.proname}: {${f.proargnames.map((name, i) => `${name}: ${tsType(f.types[i])}`).join(";")}};`,
          )
          .join("\n") +
        "\n};\n",
      { parser: "typescript" },
    );
    const path = "src/integrations/supabase/refunds.types.ts";
    if (process.argv.includes("--types")) writeFileSync(path, generated);
    else if (readFileSync(path, "utf8") !== generated)
      throw Error("Refund types differ from schema");
    await db.exec(readFileSync("supabase/accelerator-refunds.acceptance.sql", "utf8"));
    // Exercise the permissions as actual roles, not only through catalog flags.
    for (const role of ["anon", "authenticated", "sandbox_exec", "service_role"]) {
      await db.exec(`SET ROLE ${role}`);
      try {
        const statements = [
          "DELETE FROM public.accelerator_refund_receipts WHERE false",
          "TRUNCATE public.accelerator_refund_requests",
        ];
        if (role !== "service_role")
          statements.push(
            "SELECT * FROM public.accelerator_refund_requests",
            "INSERT INTO public.private_refund_reviewers(customer_id) VALUES(gen_random_uuid())",
            "SELECT public.get_accelerator_refund_queue(gen_random_uuid())",
          );
        else {
          await db.query("SELECT * FROM public.accelerator_refund_requests");
          await db.query("UPDATE public.accelerator_refund_requests SET status=status WHERE false");
          await db.query("SELECT public.get_accelerator_refund_queue(gen_random_uuid())");
        }
        for (const sql of statements) {
          let denied = false;
          try {
            await db.query(sql);
          } catch (error) {
            if (error.code !== "42501") throw error;
            denied = true;
          }
          if (!denied) throw Error(`Expected permission denial for ${role}: ${sql}`);
        }
      } finally {
        await db.exec("RESET ROLE");
      }
    }
    console.log(
      `Database defaults: ${hostedDefaults ? "hosted" : "clean"}.`,
      "Refund requests: full migration replay, behavioral acceptance, RPC permissions, and generated types passed. No external database or provider contacted.",
    );
  } catch (error) {
    console.error(error.message, error.where ?? "");
    throw error;
  } finally {
    await db.close();
  }
}
for (const hostedDefaults of [false, true]) await verifyDatabase(hostedDefaults);
