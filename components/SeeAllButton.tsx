"use client";

import { useThrottledCallback } from "@tanstack/react-pacer/throttler";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  getStaggerDelay,
  MOTION_STAGGER,
  MOTION_TRANSITION,
} from "../constants/motion";
import type { Bookmark } from "../data/bookmarks";
import { getDomainName } from "../utils/url";
import Favicon from "./Favicon";
import RotatingArrow from "./ui/RotatingArrow";

interface SeeAllButtonProps {
  remaining: Bookmark[];
  faviconMap?: Record<string, string | null>;
}

export default function SeeAllButton({
  remaining,
  faviconMap = {},
}: SeeAllButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [parentWidth, setParentWidth] = useState(720);
  const linkRef = useRef<HTMLAnchorElement>(null);

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
  // Budgeting 116px for label, arrow, padding, and alignment with the ellipsis
  const maxIconListWidth = Math.max(0, parentWidth - 116);
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
      data-see-all-reveal=""
      onMouseEnter={() => {
        setIsHovered(true);
        setIsExiting(false);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsExiting(true);
      }}
      className="relative flex items-center justify-end h-9 px-3 rounded-lg hover:bg-surface-hover transition-colors group select-none overflow-hidden gap-0 text-xs text-subtle hover:text-foreground/80 font-medium"
    >
      {/* Sliding Content Wrapper that controls exit fadeout and resets in-place */}
      <motion.div
        animate={{ opacity: isExiting ? 0 : 1 }}
        transition={
          isExiting ? MOTION_TRANSITION.feedback : MOTION_TRANSITION.enter
        }
        onAnimationComplete={() => {
          if (isExiting) {
            setIsExiting(false);
          }
        }}
        className="flex items-center"
      >
        {/* see all text wrapper */}
        <motion.div className="shrink-0 flex items-center">
          <span>see all</span>
        </motion.div>

        {/* Container for sliding favicon list (only expands width on hover) */}
        <motion.div
          initial={{ width: 0, opacity: 0, marginLeft: 0 }}
          animate={{
            width: isHovered || isExiting ? "auto" : 0,
            opacity: isHovered || isExiting ? 1 : 0,
            marginLeft: isHovered || isExiting ? 8 : 0,
            paddingRight: isHovered || isExiting ? 16 : 0,
          }}
          transition={
            isHovered || isExiting
              ? MOTION_TRANSITION.cascade
              : MOTION_TRANSITION.instant
          }
          className="flex items-center overflow-hidden shrink-0"
        >
          {itemsToRender.map((bookmark, index) => {
            const itemRevealed = getRevealedWidth(index);
            const itemOverlap = index > 0 ? ICON_WIDTH - itemRevealed : 0;

            return (
              <motion.div
                key={bookmark.url}
                data-reveal-item=""
                initial={{ x: 32, opacity: 0 }}
                animate={{
                  x: isHovered || isExiting ? 0 : 32,
                  opacity: isHovered || isExiting ? 1 : 0,
                }}
                transition={
                  isHovered || isExiting
                    ? {
                        ...MOTION_TRANSITION.cascade,
                        delay: getStaggerDelay(index, itemsToRender.length),
                      }
                    : MOTION_TRANSITION.instant
                }
                style={{
                  zIndex: index + 1,
                  marginLeft: index > 0 ? -itemOverlap : 0,
                }}
                className="relative w-4 h-4 flex items-center justify-center shrink-0 bg-background rounded-sm border border-background overflow-hidden"
              >
                {/* Favicon Wrapper that controls its opacity fade-in */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isHovered || isExiting ? 1 : 0 }}
                  transition={
                    isHovered || isExiting
                      ? {
                          ...MOTION_TRANSITION.reveal,
                          delay: getStaggerDelay(
                            index,
                            itemsToRender.length,
                            MOTION_STAGGER.maskOffset,
                          ),
                        }
                      : MOTION_TRANSITION.instant
                  }
                  className="w-full h-full flex items-center justify-center"
                >
                  <Favicon
                    src={faviconMap[getDomainName(bookmark.url)] ?? null}
                    title={bookmark.title}
                  />
                </motion.div>
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
            ? MOTION_TRANSITION.cascade
            : MOTION_TRANSITION.instant
        }
        className="h-full min-w-0"
      />

      {/* Up-Right Arrow rotating to point Right */}
      <RotatingArrow isHovered={isHovered} />
    </Link>
  );
}
