"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import BookmarkRow from "../../components/BookmarkRow";
import Footer from "../../components/Footer";
import { bookmarksData, getSortedBookmarks } from "../../data/bookmarks";
import { useFavicons } from "../../hooks/useFavicons";
import { getDomainName } from "../../utils/url";

export default function BookmarksPage() {
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
    <div className="min-h-screen text-zinc-900 font-sans antialiased relative z-10">
      <div className="max-w-3xl mx-auto px-6 py-12 sm:py-20">
        {/* Navigation */}
        <nav className="mb-12">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </nav>

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 mb-2">
            Bookmarks
          </h1>
          <p className="text-sm text-zinc-500 max-w-2xl leading-relaxed">
            A small list of tools, articles, design inspiration, and other cool
            things I keep coming back to.
          </p>
        </header>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-zinc-100">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                selectedCategory === category
                  ? "bg-zinc-900 text-white shadow-xs"
                  : "bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200/80"
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
          <div className="text-center py-20 bg-zinc-50/50 rounded-xl border border-dashed border-zinc-200">
            <p className="text-zinc-500 font-medium">
              No bookmarks found matching your criteria.
            </p>
          </div>
        )}

        {/* Footer/Framing Placeholder */}
        <Footer />
      </div>
    </div>
  );
}
