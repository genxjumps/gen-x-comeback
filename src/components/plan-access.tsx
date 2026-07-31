import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ACCESS_TOKEN_STORAGE_KEY, RAW_TOKEN_RE } from "@/lib/lead-plan";

/** Reads the stored raw access token for private plan pages. */
export function readStoredToken(): string | null {
  try {
    const v = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    return v && RAW_TOKEN_RE.test(v) ? v : null;
  } catch {
    return null;
  }
}

/** Controlled return path shown when access is missing or invalid. */
export function AccessDenied() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
      <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        This Plan Is Private
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        We could not confirm access from this browser. Open your saved results or build your plan to
        unlock it.
      </p>
      <div className="mt-6 grid gap-3 sm:flex">
        <Button asChild className="w-full sm:w-auto">
          <Link to="/assessment/complete">Go to My Results</Link>
        </Button>
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link to="/assessment/start">Build My 7-Day Plan</Link>
        </Button>
      </div>
    </div>
  );
}
