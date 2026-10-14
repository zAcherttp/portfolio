"use client";

import { useEffect, useState } from "react";
import { DitherFooter } from "@/components/DitherFooter";
import { playPopSound } from "@/lib/play-pop-sound";

export default function BottomShader() {
  const [isActive, setIsActive] = useState(false);

  // Listen for scroll-nudge events (at the bottom, scroll down more)
  useEffect(() => {
    if (isActive) return;

    const handleWheel = (e: WheelEvent) => {
      const threshold = 5;
      const isAtBottom =
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - threshold;

      if (isAtBottom && e.deltaY > 0) {
        playPopSound();
        setIsActive(true);
      }
    };

    let touchStartY = 0;
    let touchStartScrollY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        touchStartY = e.touches[0].clientY;
        // Capture scroll position at the moment the finger lands
        touchStartScrollY = window.scrollY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touchY = e.touches[0].clientY;
        const deltaY = touchStartY - touchY; // positive = swiping up (scrolling down)

        const threshold = 5;
        const maxScroll =
          document.documentElement.scrollHeight - window.innerHeight;
        // Check if the gesture *started* at the bottom, not the current position
        const startedAtBottom = touchStartScrollY >= maxScroll - threshold;

        if (startedAtBottom && deltaY > 0) {
          playPopSound();
          setIsActive(true);
        }
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [isActive]);

  return <DitherFooter active={isActive} testId="bottom-shader" />;
}
