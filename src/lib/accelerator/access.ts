import { RAW_TOKEN_RE } from "@/lib/lead-plan";

export const ACCELERATOR_ACCESS_TOKEN_STORAGE_KEY = "gxj_accelerator_token_v1";

/** Reads the paid-program credential without sharing the free-plan storage key. */
export function readStoredAcceleratorToken(): string | null {
  try {
    const value = window.localStorage.getItem(ACCELERATOR_ACCESS_TOKEN_STORAGE_KEY);
    return value && RAW_TOKEN_RE.test(value) ? value : null;
  } catch {
    return null;
  }
}
