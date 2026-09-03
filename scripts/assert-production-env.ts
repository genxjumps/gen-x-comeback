import { resolveReleaseSha, summarizeReleaseEnvironment } from "./release-identity";

const requiredClientEnv = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"] as const;

const missing = requiredClientEnv.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
  console.error(
    `[build] Refusing production build. Missing required client environment variable(s): ${missing.join(", ")}`,
  );
  process.exit(1);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL!;

try {
  const parsed = new URL(supabaseUrl);
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".supabase.co")) {
    throw new Error("unexpected Supabase URL");
  }
} catch {
  console.error(
    "[build] Refusing production build. VITE_SUPABASE_URL is not a valid HTTPS Supabase URL.",
  );
  process.exit(1);
}

let releaseSha: string;

try {
  releaseSha = resolveReleaseSha();
} catch {
  console.error("[build] Refusing production build. A verified Git release SHA is unavailable.");
  console.error(
    `[build] Release metadata variable probe (names and shape only): ${summarizeReleaseEnvironment()}`,
  );
  process.exit(1);
}

console.log("[build] Required client production environment is present.");
console.log(`[build] Release commit: ${releaseSha}`);
