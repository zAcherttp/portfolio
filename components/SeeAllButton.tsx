"use client";

import { useThrottledCallback } from "@tanstack/react-pacer/throttler";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DURATIONS, EASINGS, getStaggerDelay } from "../constants/easings";
import { usePreloadFavicons } from "../hooks/usePreloadFavicons";
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

interface SeeAllButtonProps {
  remaining: Bookmark[];
}

export default function SeeAllButton({ remaining }: SeeAllButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [parentWidth, setParentWidth] = useState(720);
  const linkRef = useRef<HTMLAnchorElement>(null);

  const domains = remaining.map((b) => getDomainName(b.url));

  // Preload favicons into cache on initial render
  usePreloadFavicons(domains);

  // Throttle state changes to at most once per 100ms
  const throttledSetParentWidth = useThrottledCallback(
    (width: number) => {
      setParentWidth(width);
    },
    { wait: 100 },
  );

  // Setup ResizeObserver on parent container
  useEffect(() => {
    const parent = linkRef.current?.parentElement;
    if (!parent) return;

    // Set initial width
    setParentWidth(parent.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        throttledSetParentWidth(entry.contentRect.width);
      }
    });

    observer.observe(parent);
    return () => observer.disconnect();
  }, [throttledSetParentWidth]);

  // Compute logarithmic spacing & truncation based on parent width
  // Budgeting 108px for label, arrow, padding, and alignment with the ellipsis
  const maxIconListWidth = Math.max(0, parentWidth - 108);
  const totalItems = remaining.length;
  const ICON_WIDTH = 16;
  const DEFAULT_REVEALED = 13.33; // 5/6 revealed (16 - 2.67px overlap)
  const MIN_REVEALED = 2.0; // legibility threshold (16 - 14.0px overlap)

  // Precalculate log sums: logSums[i] = sum_{j=1}^{i} ln(j)
  const logSums = [0];
  let currentLogSum = 0;
  for (let j = 1; j <= totalItems; j++) {
    currentLogSum += Math.log(j);
    logSums.push(currentLogSum);
  }

  // Iteratively find the maximum number of items (k) we can render
  // such that every item satisfies V(i) >= MIN_REVEALED and fits in maxIconListWidth
  let k = totalItems;
  let c = 0;

  while (k > 1) {
    const defaultTotalWidth = ICON_WIDTH + (k - 1) * DEFAULT_REVEALED;
    if (defaultTotalWidth <= maxIconListWidth) {
      c = 0;
      break;
    }

    const sumLnK = logSums[k - 1];
    if (sumLnK > 0) {
      c = (defaultTotalWidth - maxIconListWidth) / sumLnK;
      const minSpacing = DEFAULT_REVEALED - c * Math.log(k - 1);
      if (minSpacing >= MIN_REVEALED) {
        // Found the optimal fit
        break;
      }
    }
    k--;
  }

  const itemsToRender = remaining.slice(0, k);

  const getRevealedWidth = (index: number) => {
    if (index === 0) return ICON_WIDTH;
    return Math.max(MIN_REVEALED, DEFAULT_REVEALED - c * Math.log(index));
  };

  return (
    <Link
      ref={linkRef}
      href="/bookmarks"
      onMouseEnter={() => {
        setIsHovered(true);
        setIsExiting(false);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsExiting(true);
      }}
      className="relative flex items-center justify-end h-9 px-3 rounded-lg hover:bg-zinc-100/70 transition-colors group select-none overflow-hidden gap-0 text-xs font-mono text-zinc-400 group-hover:text-zinc-800 transition-colors font-medium"
    >
      {/* Sliding Content Wrapper that controls exit fadeout and resets in-place */}
      <motion.div
        animate={{ opacity: isExiting ? 0 : 1 }}
        transition={{
          duration: isExiting ? DURATIONS.fadeExit : DURATIONS.fadeEnter,
          ease: "easeInOut",
        }}
        onAnimationComplete={() => {
          if (isExiting) {
            setIsExiting(false);
          }
        }}
        className="flex items-center"
      >
        {/* see all text wrapper */}
        <motion.div className="flex-shrink-0 flex items-center">
          <span>see all</span>
        </motion.div>

        {/* Container for sliding favicon list (only expands width on hover) */}
        <motion.div
          initial={{ width: 0, opacity: 0, marginLeft: 0 }}
          animate={{
            width: isHovered || isExiting ? "auto" : 0,
            opacity: isHovered || isExiting ? 1 : 0,
            marginLeft: isHovered || isExiting ? 8 : 0,
          }}
          transition={
            isHovered || isExiting
              ? { duration: DURATIONS.enter, ease: EASINGS.easeOutQuint }
              : { duration: DURATIONS.exit }
          }
          className="flex items-center overflow-hidden flex-shrink-0 pr-4"
        >
          {itemsToRender.map((bookmark, index) => {
            const itemRevealed = getRevealedWidth(index);
            const itemOverlap = index > 0 ? ICON_WIDTH - itemRevealed : 0;

            return (
              <motion.div
                key={bookmark.id}
                initial={{ x: 32, opacity: 0 }}
                animate={{
                  x: isHovered || isExiting ? 0 : 32,
                  opacity: isHovered || isExiting ? 1 : 0,
                }}
                transition={
                  isHovered || isExiting
                    ? {
                        duration: DURATIONS.enter,
                        delay: getStaggerDelay(
                          index,
                          0.15,
                          itemsToRender.length,
                        ),
                        ease: EASINGS.easeOutQuint,
                      }
                    : { duration: DURATIONS.exit }
                }
                style={{
                  zIndex: index + 1,
                  marginLeft: index > 0 ? -itemOverlap : 0,
                }}
                className="relative w-4 h-4 flex items-center justify-center flex-shrink-0 bg-zinc-200 rounded-sm border border-white overflow-hidden"
              >
                {/* Favicon */}
                <Favicon
                  domain={getDomainName(bookmark.url)}
                  title={bookmark.title}
                />

                {/* Grey Mask Overlay */}
                <motion.div
                  initial={{ opacity: 1 }}
                  animate={{ opacity: isHovered || isExiting ? 0 : 1 }}
                  transition={
                    isHovered || isExiting
                      ? {
                          duration: 0.4,
                          delay: getStaggerDelay(
                            index,
                            0.25,
                            itemsToRender.length,
                          ),
                          ease: "easeInOut",
                        }
                      : { duration: DURATIONS.exit }
                  }
                  className="absolute inset-0 bg-zinc-200 rounded-sm"
                />
              </motion.div>
            );
          })}
        </motion.div>
      </motion.div>

      {/* Dynamic Flex Spacer that expands on hover to push "see all" to the left */}
      <motion.div
        animate={{ flexGrow: isHovered || isExiting ? 1 : 0 }}
        transition={
          isHovered || isExiting
            ? { duration: DURATIONS.enter, ease: EASINGS.easeOutQuint }
            : { duration: DURATIONS.exit }
        }
        className="h-full min-w-0"
      />

      {/* Up-Right Arrow rotating to point Right */}
      <RotatingArrow isHovered={isHovered} />
    </Link>
  );
}
