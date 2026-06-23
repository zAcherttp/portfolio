"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import BookmarkRow from "../../components/BookmarkRow";
import Footer from "../../components/Footer";
import { bookmarksData, getSortedBookmarks } from "../../data/bookmarks";
import { useFavicons } from "../../hooks/useFavicons";
import { getDomainName } from "../../utils/url";

export default function BookmarksPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const { data: faviconMap } = useFavicons();

  const categories = [
    "All",
    ...Array.from(new Set(bookmarksData.map((b) => b.category))).sort(),
  ];

  const sortedBookmarks = getSortedBookmarks();
  const filteredBookmarks = sortedBookmarks.filter(
    (bookmark) =>
      selectedCategory === "All" || bookmark.category === selectedCategory,
  );

  return (
    <div className="min-h-screen text-foreground font-sans antialiased relative z-10">
      <div className="max-w-3xl mx-auto px-6 py-12 sm:py-20">
        {/* Navigation */}
        <nav className="mb-12">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </nav>

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-xl font-bold tracking-tight text-foreground mb-2">
            Bookmarks
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            A small list of tools, articles, design inspiration, and other cool
            things I keep coming back to.
          </p>
        </header>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-border">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                selectedCategory === category
                  ? "bg-foreground text-background shadow-xs"
                  : "bg-muted text-muted-foreground hover:bg-surface-hover"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Bookmarks List */}
        {filteredBookmarks.length > 0 ? (
          <div className="flex flex-col -mx-3 pb-4">
            {filteredBookmarks.map((bookmark) => (
              <BookmarkRow
                key={bookmark.url}
                bookmark={bookmark}
                faviconSrc={faviconMap?.[getDomainName(bookmark.url)] ?? null}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-muted/50 rounded-xl border border-dashed border-border">
            <p className="text-muted-foreground font-medium">
              No bookmarks found matching your criteria.
            </p>
          </div>
        )}

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}
