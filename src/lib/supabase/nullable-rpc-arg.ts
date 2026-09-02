/**
 * Supabase's generated `Args` types mark every SQL function parameter as
 * non-nullable, because none of these parameters declare a SQL default.
 * Several of our live SQL functions deliberately accept NULL for semantically
 * optional arguments (optional starting measurements, optional notes, optional
 * first name).
 *
 * This helper passes the runtime value through completely unchanged — including
 * `null` — and only widens what TypeScript accepts at the call site, so we do
 * not need `any` casts or edits to the generated types file.
 */
export function nullableRpcArg<T>(value: T | null): T {
  return value as T;
}
