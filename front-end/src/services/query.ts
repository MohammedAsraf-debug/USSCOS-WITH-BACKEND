/**
 * TanStack Query client (M0: declared, not wired to any data source).
 * `services/query.ts` owns the QueryClient + invalidation map
 * (PROJECT_STRUCTURE §6).
 */
import { QueryClient } from "@tanstack/react-query";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}
