"use client";

import { useState } from "react";
import type { Bookmark } from "../data/bookmarks";
import { getDomainName } from "../utils/url";
import { ExternalLink } from "./ExternalLink";
import Favicon from "./Favicon";
import ListRowFrame from "./ui/ListRowFrame";
import RotatingArrow from "./ui/RotatingArrow";

interface BookmarkRowProps {
  bookmark: Bookmark;
  faviconSrc?: string | null;
}

export default function BookmarkRow({
  bookmark,
  faviconSrc,
}: BookmarkRowProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <ListRowFrame
      render={
        <ExternalLink
          attributionContext="bookmark"
          href={bookmark.url}
          target="_blank"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        />
      }
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Icon */}
        <div className="shrink-0 flex items-center justify-center w-4 h-4">
          <Favicon src={faviconSrc} title={bookmark.title} />
        </div>

        {/* Text details */}
        <div className="flex items-center gap-1 min-w-0 text-sm">
          <span className="font-normal text-foreground truncate shrink-0">
            {bookmark.title}
          </span>
          <span className="text-subtle-2 font-light select-none shrink-0">
            ::
          </span>
          <span className="text-muted-foreground truncate min-w-0">
            {bookmark.description}
          </span>
        </div>
      </div>

      {/* Link / Domain */}
      <div className="flex items-center text-xs text-subtle group-hover:text-foreground/80 font-medium ml-4 shrink-0 transition-colors">
        <span className="hidden sm:inline">{getDomainName(bookmark.url)}</span>
        <RotatingArrow isHovered={isHovered} />
      </div>
    </ListRowFrame>
  );
}
