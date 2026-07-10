"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { playPopSound } from "@/utils/playPopSound";

const Dither = dynamic(() => import("./ui/shaders/dither"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-transparent" />,
});

export default function BottomShader() {
  const pathname = usePathname();
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [burnProgress, setBurnProgress] = useState(0.35);
  const [animatedFlameHeight, setAnimatedFlameHeight] = useState(0.1);
  const [animatedFireSpeed, setAnimatedFireSpeed] = useState(0.8);
  const [animatedNoiseStrength, setAnimatedNoiseStrength] = useState(0.5);
  const { theme, systemTheme } = useTheme();

  // WebGL compatibility check
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const supportsWebGL = !!(
        window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
      );
      setIsSupported(supportsWebGL);
    } catch {
      setIsSupported(false);
    }
  }, []);

  // Cozy wuthering animation over 3500ms when activated
  useEffect(() => {
    if (!isActive) return;

    let frameId: number;
    const startTime = performance.now();
    const duration = 1500; // 1500ms cozy warm-up duration

    const targetFlameHeight = 0.8;
    const targetFireSpeed = 0.8;
    const targetNoiseStrength = 0.5;

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(1.0, elapsed / duration);

      // Non-linear easing curves for cozy feel
      const easedProgress = 1.0 - (1.0 - progress) ** 3; // both start fast, end slow (ease-out)
      const currentProgress = 0.35 + easedProgress * (1.0 - 0.35);
      const currentHeight = 0.1 + easedProgress * (targetFlameHeight - 0.1);
      const currentSpeed = 0.8 + progress * (targetFireSpeed - 0.8);
      const currentNoiseStr = 0.5 + progress * (targetNoiseStrength - 0.5);

      setBurnProgress(currentProgress);
      setAnimatedFlameHeight(currentHeight);
      setAnimatedFireSpeed(currentSpeed);
      setAnimatedNoiseStrength(currentNoiseStr);

      if (progress < 1.0) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [isActive]);

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
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, [isActive]);

  if (pathname === "/playground") {
    return null;
  }

  if (isSupported === null || !isSupported) {
    return (
      <div className="w-full h-32 -mt-8 bg-transparent pointer-events-none" />
    );
  }

  // Resolve theme-aware colors
  const activeTheme = theme === "system" ? systemTheme : theme;
  const isDark = activeTheme === "dark";

  // Dark mode: physics-based blue flame gradient.
  // Light mode: physics-based orange-red fire gradient.
  const waveColor: [number, number, number] = isDark
    ? [0.9804, 0.9804, 0.9804] // white  (dark mode fallback / unused when gradient active)
    : [0.0392, 0.0392, 0.0392]; // dark   (light mode fallback / unused when gradient active)

  // Blue flame palette — dark mode (electric blue strands, white-blue core glows on dark bg)
  const blueFlameColors: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ] = [
    [0.0, 0.565, 1.0], // #0090FF – vivid electric blue, outer strands
    [0.0, 0.753, 1.0], // #00C0FF – bright cyan-blue, mid body
    [0.941, 0.98, 1.0], // #F0FAFF – white-blue, hot inner core
  ];

  // Orange-red fire palette — light mode (red tips, orange body, hot yellow core)
  const orangeFlameColors: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ] = [
    [1.0, 0.141, 0.0], // #FF2400 – saturated red-orange, outer strands / tips
    [1.0, 0.431, 0.0], // #FF6E00 – vivid orange, main flame body
    [1.0, 0.788, 0.118], // #FFC91E – hot yellow core, stays visible on white bg
  ];

  return (
    <div className="w-full h-32 -mt-8 relative overflow-hidden pointer-events-none">
      {isActive && (
        <Dither
          fireSpeed={animatedFireSpeed}
          noiseScale={[4.0, 2.0]}
          flameHeight={animatedFlameHeight}
          noiseStrength={animatedNoiseStrength}
          burnProgress={burnProgress}
          fireRange={[0.2, 1.0]}
          colorNum={3}
          pixelSize={3}
          ditherOpacity={isDark ? [1.0, 1.0] : [0.42, 0.94]}
          waveColor={waveColor}
          flameColors={isDark ? blueFlameColors : orangeFlameColors}
          flameBodyHeat={isDark ? 0.5 : 0.7}
          flameHeatPower={isDark ? 1.0 : 1.18}
          flamePositionBias={isDark ? 0.15 : 0.2}
        />
      )}
    </div>
  );
}
