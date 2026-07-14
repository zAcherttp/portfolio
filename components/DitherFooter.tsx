"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const Dither = dynamic(() => import("./ui/shaders/dither"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-transparent" />,
});

const BLUE_FLAME_COLORS: [
  [number, number, number],
  [number, number, number],
  [number, number, number],
] = [
  [0.0, 0.565, 1.0],
  [0.0, 0.753, 1.0],
  [0.941, 0.98, 1.0],
];

const ORANGE_FLAME_COLORS: [
  [number, number, number],
  [number, number, number],
  [number, number, number],
] = [
  [1.0, 0.141, 0.0],
  [1.0, 0.431, 0.0],
  [1.0, 0.788, 0.118],
];

export interface DitherFooterProps {
  /** Controls whether the shader and its warm-up animation are running. */
  active?: boolean;
  /** Classes applied to the shader container. */
  className?: string;
  /** Base test identifier used by the rendered and fallback states. */
  testId?: string;
}

export function DitherFooter({
  active = true,
  className = "-mt-8 h-32 w-full",
  testId = "dither-footer",
}: DitherFooterProps) {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [burnProgress, setBurnProgress] = useState(0.35);
  const [flameHeight, setFlameHeight] = useState(0.1);
  const { theme, systemTheme } = useTheme();

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

  useEffect(() => {
    if (!active) return;

    setBurnProgress(0.35);
    setFlameHeight(0.1);

    let frameId: number;
    const startTime = performance.now();
    const duration = 1500;

    const animate = (time: number) => {
      const progress = Math.min(1, (time - startTime) / duration);
      const easedProgress = 1 - (1 - progress) ** 3;

      setBurnProgress(0.35 + easedProgress * 0.65);
      setFlameHeight(0.1 + easedProgress * 0.7);

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [active]);

  const containerClassName = `${className} relative overflow-hidden bg-transparent pointer-events-none`;

  if (isSupported === null || !isSupported) {
    return (
      <div className={containerClassName} data-testid={`${testId}-fallback`} />
    );
  }

  const activeTheme = theme === "system" ? systemTheme : theme;
  const isDark = activeTheme === "dark";
  const waveColor: [number, number, number] = isDark
    ? [0.9804, 0.9804, 0.9804]
    : [0.0392, 0.0392, 0.0392];

  return (
    <div className={containerClassName} data-testid={testId}>
      {active && (
        <Dither
          fireSpeed={0.8}
          noiseScale={[4.0, 2.0]}
          flameHeight={flameHeight}
          noiseStrength={0.5}
          burnProgress={burnProgress}
          fireRange={[0.2, 1.0]}
          colorNum={3}
          pixelSize={3}
          ditherOpacity={isDark ? [1.0, 1.0] : [0.42, 0.94]}
          waveColor={waveColor}
          flameColors={isDark ? BLUE_FLAME_COLORS : ORANGE_FLAME_COLORS}
          flameBodyHeat={isDark ? 0.5 : 0.7}
          flameHeatPower={isDark ? 1.0 : 1.18}
          flamePositionBias={isDark ? 0.15 : 0.2}
        />
      )}
    </div>
  );
}
