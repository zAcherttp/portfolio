"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const Dither = dynamic(() => import("./ui/shaders/dither"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-transparent" />,
});

// Synthesizes a mechanical pop/click sound dynamically using the Web Audio API
const playClickSound = () => {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch (error) {
    console.warn("Web Audio API click sound blocked or failed:", error);
  }
};

export default function BottomShader() {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [burnProgress, setBurnProgress] = useState(0.0);
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

  // Animate burnProgress from 0.0 to 1.0 when activated
  useEffect(() => {
    if (!isActive) return;

    let frameId: number;
    let currentProgress = 0.0;

    const animate = () => {
      currentProgress += 0.022; // ~45 frames to reach full stable burn (~0.75s)
      if (currentProgress > 1.0) {
        currentProgress = 1.0;
        setBurnProgress(1.0);
      } else {
        setBurnProgress(currentProgress);
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [isActive]);

  // Listen for scroll-nudge events (at the bottom, scroll down more)
  useEffect(() => {
    if (isActive) return;

    let accumulatedDelta = 0;
    let resetTimer: NodeJS.Timeout | null = null;

    const handleWheel = (e: WheelEvent) => {
      const threshold = 5;
      const isAtBottom =
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - threshold;

      if (isAtBottom && e.deltaY > 0) {
        accumulatedDelta += e.deltaY;

        if (resetTimer) clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
          accumulatedDelta = 0;
        }, 300);

        if (accumulatedDelta >= 35) {
          playClickSound();
          setIsActive(true);
        }
      }
    };

    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        touchStartY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touchY = e.touches[0].clientY;
        const deltaY = touchStartY - touchY; // positive means swipe up (scrolling down)
        const threshold = 5;
        const isAtBottom =
          window.scrollY + window.innerHeight >=
          document.documentElement.scrollHeight - threshold;

        if (isAtBottom && deltaY > 30) {
          playClickSound();
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

  if (isSupported === null || !isSupported) {
    return (
      <div className="w-full h-[120px] bg-transparent pointer-events-none" />
    );
  }

  // Resolve theme-aware colors (light mode: black fire, dark mode: white fire)
  const activeTheme = theme === "system" ? systemTheme : theme;
  const isDark = activeTheme === "dark";
  const waveColor: [number, number, number] = isDark
    ? [0.985, 0.985, 0.985] // zinc-50
    : [0.047, 0.047, 0.047]; // zinc-900

  return (
    <div className="w-full h-[120px] relative overflow-hidden pointer-events-none mt-12">
      {isActive && (
        <Dither
          fireSpeed={0.55}
          noiseScale={[3.5, 2.8]}
          flameHeight={0.85}
          noiseStrength={0.42}
          burnProgress={burnProgress}
          windStrength={0.55}
          blowRadius={0.5}
          blowForce={0.65}
          colorNum={2} // Strict binary dither
          pixelSize={3}
          waveColor={waveColor}
        />
      )}
    </div>
  );
}
