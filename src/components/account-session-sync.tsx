import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { watchLogoutEvents } from "@/lib/account/browser-session";

/** Discard private in-memory pages in other tabs and when restoring browser Back. */
export function AccountSessionSync() {
  const queryClient = useQueryClient();
  useEffect(() => watchLogoutEvents(() => queryClient.clear()), [queryClient]);
  return null;
}
