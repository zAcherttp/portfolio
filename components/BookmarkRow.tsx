"use client";

import { useState } from "react";
import { getDomainName } from "../utils/url";
import Favicon from "./Favicon";
import RotatingArrow from "./ui/RotatingArrow";

interface Bookmark {
  id: string;
  title: string;
  description: string;
  url: string;
  category: string;
  tags: string[];
}

interface BookmarkRowProps {
  bookmark: Bookmark;
}

export default function BookmarkRow({ bookmark }: BookmarkRowProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <a
      href={bookmark.url}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-zinc-100/70 transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Icon */}
        <div className="flex-shrink-0 flex items-center justify-center w-4 h-4">
          <Favicon
            domain={getDomainName(bookmark.url)}
            title={bookmark.title}
          />
        </div>

        {/* Text details */}
        <div className="flex items-center gap-1 min-w-0 text-sm">
          <span className="font-normal text-zinc-950 truncate shrink-0">
            {bookmark.title}
          </span>
          <span className="text-zinc-400 font-light select-none shrink-0">
            ::
          </span>
          <span className="text-zinc-600 truncate min-w-0">
            {bookmark.description}
          </span>
        </div>
      </div>

      {/* Link / Domain */}
      <div className="flex items-center text-xs text-zinc-400 group-hover:text-zinc-800 font-medium ml-4 flex-shrink-0 transition-colors">
        <span className="hidden sm:inline">{getDomainName(bookmark.url)}</span>
        <RotatingArrow isHovered={isHovered} />
      </div>
    </a>
  );
}
