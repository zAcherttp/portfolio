"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import BookmarkRow from "../../components/BookmarkRow";
import { bookmarksData } from "../../data/bookmarks";

export default function BookmarksPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const categories = ["All", "Design", "Dev Tools", "Inspiration", "Resources"];

  const filteredBookmarks = bookmarksData.filter((bookmark) => {
    const matchesSearch =
      bookmark.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bookmark.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bookmark.tags.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase()),
      );

    const matchesCategory =
      selectedCategory === "All" || bookmark.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-[#fefefe] text-zinc-900 font-sans antialiased">
      <div className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
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
        <header className="mb-16">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl mb-4">
            Bookmarks
          </h1>
          <p className="text-lg text-zinc-500 max-w-2xl leading-relaxed">
            A curated directory of tools, articles, design inspiration, and cool
            resources that I have saved over the years.
          </p>
        </header>

        {/* Filters and Search controls */}
        <div className="flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center mb-10 pb-6 border-b border-zinc-100">
          {/* Category Filters */}
          <div className="flex flex-wrap gap-2">
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

          {/* Search Input */}
          <div className="w-full sm:w-auto min-w-[280px]">
            <input
              type="text"
              placeholder="Search bookmarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 text-sm rounded-lg border border-zinc-200 bg-white/50 backdrop-blur-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 transition-all placeholder-zinc-400"
            />
          </div>
        </div>

        {/* Bookmarks List */}
        {filteredBookmarks.length > 0 ? (
          <div className="flex flex-col -mx-3">
            {filteredBookmarks.map((bookmark) => (
              <BookmarkRow key={bookmark.id} bookmark={bookmark} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-zinc-50/50 rounded-xl border border-dashed border-zinc-200">
            <p className="text-zinc-500 font-medium">
              No bookmarks found matching your criteria.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
