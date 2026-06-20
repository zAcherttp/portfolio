import { useQuery } from "@tanstack/react-query";
import { fetchFaviconBlob } from "../utils/url";

export const usePreloadFavicons = (domains: string[]) => {
  return useQuery({
    queryKey: ["favicons", domains],
    queryFn: async () => {
      const promises = domains.map((domain) => fetchFaviconBlob(domain));
      return Promise.all(promises);
    },
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
  });
};
