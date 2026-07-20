import { useQuery } from "@tanstack/react-query";
import type { FaviconMap } from "@/lib/favicons";

// Fetches all bookmarks' favicons from the server in one request.
// queryKey is a stable constant so TanStack never creates orphan queries.
export const useFavicons = () => {
  return useQuery<FaviconMap>({
    queryKey: ["favicons"],
    queryFn: async () => {
      const res = await fetch("/api/favicons", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch favicons");
      return res.json() as Promise<FaviconMap>;
    },
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 1000 * 60 * 60 * 24,
  });
};
