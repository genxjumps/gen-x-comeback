import { ACCESS_TOKEN_STORAGE_KEY, RAW_TOKEN_RE } from "@/lib/lead-plan";

/** Reads the stored raw access token for private plan pages. */
export function readStoredToken(): string | null {
  try {
    const value = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    return value && RAW_TOKEN_RE.test(value) ? value : null;
  } catch {
    return null;
  }
}

/** Clearing an unrelated browser credential must not block cookie-based access. */
export function clearStoredToken(): void {
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    /* cookie access remains available */
  }
}
