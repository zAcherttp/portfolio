"use client";

import { useState } from "react";
import BookmarkRow from "@/components/BookmarkRow";
import {
  type Bookmark,
  bookmarksData,
  getSortedBookmarks,
} from "@/data/bookmarks";
import { useFavicons } from "@/hooks/useFavicons";
import { getDomainName } from "@/utils/url";

type BookmarkFilter = Bookmark["category"] | "All";

const categories: readonly BookmarkFilter[] = [
  "All",
  ...Array.from(
    new Set(bookmarksData.map((bookmark) => bookmark.category)),
  ).sort(),
];

export function BookmarksList() {
  const [selectedCategory, setSelectedCategory] =
    useState<BookmarkFilter>("All");
  const { data: faviconMap } = useFavicons();
  const filteredBookmarks = getSortedBookmarks().filter(
    (bookmark) =>
      selectedCategory === "All" || bookmark.category === selectedCategory,
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-4">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setSelectedCategory(category)}
            className={`cursor-pointer rounded-full px-4 py-1.5 font-medium text-sm transition-all ${
              selectedCategory === category
                ? "bg-foreground text-background shadow-xs"
                : "bg-muted text-muted-foreground hover:bg-surface-hover"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {filteredBookmarks.length > 0 ? (
        <div className="-mx-3 flex flex-col pb-4">
          {filteredBookmarks.map((bookmark) => (
            <BookmarkRow
              key={bookmark.url}
              bookmark={bookmark}
              faviconSrc={faviconMap?.[getDomainName(bookmark.url)] ?? null}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border border-dashed bg-muted/50 py-20 text-center">
          <p className="font-medium text-muted-foreground">
            No bookmarks found matching your criteria.
          </p>
        </div>
      )}
    </>
  );
}
