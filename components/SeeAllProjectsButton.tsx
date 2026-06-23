"use client";

import { useThrottledCallback } from "@tanstack/react-pacer/throttler";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  CPlusPlus,
  CSharp,
  Git,
  Golang,
  Javascript,
  Typescript,
} from "@/components/ui/svgs";
import type { Project } from "@/data/projects";
import { DURATIONS, EASINGS, getStaggerDelay } from "../constants/easings";
import RotatingArrow from "./ui/RotatingArrow";

interface SeeAllProjectsButtonProps {
  remaining: Project[];
}

export default function SeeAllProjectsButton({
  remaining,
}: SeeAllProjectsButtonProps) {
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

  // Get unique primary languages from the remaining projects
  const uniqueLanguages = Array.from(
    new Set(remaining.map((p) => p.primaryLanguage)),
  );
  const languageItems = uniqueLanguages.map((lang) => ({
    id: lang,
    primaryLanguage: lang,
  }));

  // Compute logarithmic spacing & truncation based on parent width
  const maxIconListWidth = Math.max(0, parentWidth - 116);
  const totalItems = languageItems.length;
  const ICON_WIDTH = 16;
  const DEFAULT_REVEALED = 13.33; // 5/6 revealed
  const MIN_REVEALED = 2.0; // legibility threshold

  // Precalculate log sums
  const logSums = [0];
  let currentLogSum = 0;
  for (let j = 1; j <= totalItems; j++) {
    currentLogSum += Math.log(j);
    logSums.push(currentLogSum);
  }

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
        break;
      }
    }
    k--;
  }

  const itemsToRender = languageItems.slice(0, k);

  const getRevealedWidth = (index: number) => {
    if (index === 0) return ICON_WIDTH;
    return Math.max(MIN_REVEALED, DEFAULT_REVEALED - c * Math.log(index));
  };

  const renderIcon = (lang: string) => {
    const props = { className: "w-3 h-3" };
    switch (lang) {
      case "TypeScript":
        return <Typescript {...props} />;
      case "JavaScript":
        return <Javascript {...props} />;
      case "Go":
        return <Golang {...props} />;
      case "C++":
        return <CPlusPlus {...props} />;
      case "C#":
        return <CSharp {...props} />;
      default:
        return <Git {...props} className="w-3 h-3 text-zinc-400" />;
    }
  };

  return (
    <Link
      ref={linkRef}
      href="/projects"
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
        <motion.div className="shrink-0 flex items-center">
          <span>see all</span>
        </motion.div>

        {/* Container for sliding language list */}
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
              ? { duration: DURATIONS.enter, ease: EASINGS.easeOutQuint }
              : { duration: DURATIONS.exit }
          }
          className="flex items-center overflow-hidden shrink-0"
        >
          {itemsToRender.map((project, index) => {
            const itemRevealed = getRevealedWidth(index);
            const itemOverlap = index > 0 ? ICON_WIDTH - itemRevealed : 0;

            return (
              <motion.div
                key={project.id}
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
                          DURATIONS.staggerBase,
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
                className="relative w-4 h-4 flex items-center justify-center shrink-0 bg-background rounded-sm border border-border overflow-hidden"
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isHovered || isExiting ? 1 : 0 }}
                  transition={
                    isHovered || isExiting
                      ? {
                          duration: 0.4,
                          delay: getStaggerDelay(
                            index,
                            DURATIONS.staggerMaskBase,
                            itemsToRender.length,
                          ),
                          ease: "easeInOut",
                        }
                      : { duration: DURATIONS.exit }
                  }
                  className="w-full h-full flex items-center justify-center"
                >
                  {renderIcon(project.primaryLanguage)}
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>
      </motion.div>

      <motion.div
        animate={{ flexGrow: isHovered || isExiting ? 1 : 0 }}
        transition={
          isHovered || isExiting
            ? { duration: DURATIONS.enter, ease: EASINGS.easeOutQuint }
            : { duration: DURATIONS.exit }
        }
        className="h-full min-w-0"
      />

      <RotatingArrow isHovered={isHovered} />
    </Link>
  );
}
