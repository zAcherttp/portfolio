"use client";

import BookmarkRow from "@/components/BookmarkRow";
import SeeAllButton from "@/components/SeeAllButton";
import { getSortedBookmarks } from "@/data/bookmarks";
import { useFavicons } from "@/hooks/useFavicons";
import { getDomainName } from "@/utils/url";

export function HomeBookmarks() {
  const sortedBookmarks = getSortedBookmarks();
  const { data: faviconMap } = useFavicons();

  return (
    <section className="mb-12">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-normal text-muted-foreground">Bookmarks</h2>
      </div>

      <div className="-ml-3 flex flex-col pb-4">
        {sortedBookmarks.slice(0, 3).map((bookmark) => (
          <BookmarkRow
            key={bookmark.url}
            bookmark={bookmark}
            faviconSrc={faviconMap?.[getDomainName(bookmark.url)] ?? null}
          />
        ))}

        <SeeAllButton
          remaining={sortedBookmarks.slice(3)}
          faviconMap={faviconMap ?? {}}
        />
      </div>
    </section>
  );
}
