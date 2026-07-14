"use client";

import { button, useControls } from "leva";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import Dither from "@/components/ui/shaders/dither";

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

export default function PlaygroundClient() {
  const [animatedProgress, setAnimatedProgress] = useState(1.0);
  const [animatedFlameHeight, setAnimatedFlameHeight] = useState(0.8);
  const [animatedFireSpeed, setAnimatedFireSpeed] = useState(0.8);
  const [animatedNoiseStrength, setAnimatedNoiseStrength] = useState(0.5);
  const [isAnimating, setIsAnimating] = useState(false);

  // Leva controls for shader parameters
  const [values, set] = useControls(() => ({
    fireSpeed: {
      value: 0.8,
      min: 0.0,
      max: 2.0,
      step: 0.05,
      label: "Fire Speed",
    },
    noiseScaleX: {
      value: 4.0,
      min: 0.5,
      max: 10.0,
      step: 0.1,
      label: "Noise Scale X",
    },
    noiseScaleY: {
      value: 2.0,
      min: 0.5,
      max: 10.0,
      step: 0.1,
      label: "Noise Scale Y",
    },
    flameHeight: {
      value: 0.8,
      min: 0.1,
      max: 1.2,
      step: 0.05,
      label: "Flame Height",
    },
    noiseStrength: {
      value: 0.5,
      min: 0.0,
      max: 1.0,
      step: 0.02,
      label: "Noise Strength",
    },
    burnProgress: {
      value: 1.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: "Burn Progress",
    },
    fireRange: {
      value: [0.2, 1.0],
      min: 0.0,
      max: 1.0,
      step: 0.01,
      label: "Fire Range",
    },

    colorNum: { value: 3, min: 2, max: 8, step: 1, label: "Dither Colors" },
    pixelSize: { value: 3, min: 1, max: 10, step: 1, label: "Pixel Size" },
    themeOverride: {
      value: "dark",
      options: ["dark", "light"],
      label: "Theme View",
    },

    // Action trigger inside Leva panel
    "Trigger Elastic Nudge": button(() => {
      playClickSound();
      setIsAnimating(true);
      set({
        burnProgress: 0.35,
        flameHeight: 0.1,
        fireSpeed: 0.8,
        noiseStrength: 0.5,
        fireRange: [0.2, 1.0],
      });
      setAnimatedProgress(0.35);
      setAnimatedFlameHeight(0.1);
      setAnimatedFireSpeed(0.8);
      setAnimatedNoiseStrength(0.5);
    }),
  }));

  // Cozy wuthering animation over 1500ms when Trigger is clicked
  useEffect(() => {
    if (!isAnimating) return;

    let frameId: number;
    const startTime = performance.now();
    const duration = 1500; // 1500ms cozy warm-up duration

    const targetFlameHeight = 0.8;
    const targetFireSpeed = 0.8;
    const targetNoiseStrength = 0.5;

    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(1.0, elapsed / duration);

      // Easing curves matching custom starting/final values
      const easedProgress = 1.0 - (1.0 - progress) ** 3; // both start fast, end slow (ease-out)
      const currentProgress = 0.35 + easedProgress * (1.0 - 0.35);
      const currentHeight = 0.1 + easedProgress * (targetFlameHeight - 0.1);
      const currentSpeed = 0.8 + progress * (targetFireSpeed - 0.8);
      const currentNoiseStr = 0.5 + progress * (targetNoiseStrength - 0.5);

      setAnimatedProgress(currentProgress);
      setAnimatedFlameHeight(currentHeight);
      setAnimatedFireSpeed(currentSpeed);
      setAnimatedNoiseStrength(currentNoiseStr);

      // Sync with Leva panel in real-time
      set({
        burnProgress: Number(currentProgress.toFixed(3)),
        flameHeight: Number(currentHeight.toFixed(3)),
        fireSpeed: Number(currentSpeed.toFixed(3)),
        noiseStrength: Number(currentNoiseStr.toFixed(3)),
      });

      if (progress < 1.0) {
        frameId = requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [isAnimating, set]);

  // Synchronize manual slider change with local animated states when not animating
  useEffect(() => {
    if (!isAnimating) {
      setAnimatedProgress(values.burnProgress);
      setAnimatedFlameHeight(values.flameHeight);
      setAnimatedFireSpeed(values.fireSpeed);
      setAnimatedNoiseStrength(values.noiseStrength);
    }
  }, [
    values.burnProgress,
    values.flameHeight,
    values.fireSpeed,
    values.noiseStrength,
    isAnimating,
  ]);

  const isDark = values.themeOverride === "dark";
  const waveColor: [number, number, number] = isDark
    ? [0.9804, 0.9804, 0.9804] // oklch(0.985 0 0) -> rgb(250, 250, 250) -> [0.9804, 0.9804, 0.9804]
    : [0.0392, 0.0392, 0.0392]; // oklch(0.145 0 0) -> rgb(10, 10, 10) -> [0.0392, 0.0392, 0.0392] - matches Tuấn Phát name text color in light mode

  const blueFlameColors: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ] = [
    [0.0, 0.565, 1.0],
    [0.0, 0.753, 1.0],
    [0.941, 0.98, 1.0],
  ];

  const orangeFlameColors: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ] = [
    [1.0, 0.141, 0.0],
    [1.0, 0.431, 0.0],
    [1.0, 0.788, 0.118],
  ];

  return (
    <div
      className={`min-h-screen font-sans flex flex-col justify-between transition-colors duration-300 relative select-none ${
        isDark ? "bg-[#141414] text-zinc-100" : "bg-[#fefefe] text-zinc-900"
      }`}
    >
      {/* Header controls overlay */}
      <header className="p-6 relative z-20 flex flex-col gap-2 pointer-events-auto">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className={`inline-flex items-center gap-1.5 text-sm font-medium ${
              isDark
                ? "text-zinc-400 hover:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900"
            } transition-colors`}
          >
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
        </div>
        <div className="mt-4">
          <h1 className="text-xl font-bold tracking-tight">
            Shader Playground
          </h1>
          <p
            className={`text-xs mt-1 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
          >
            Adjust and tune parameters using the Leva panel on the top right.
          </p>
        </div>
      </header>

      {/* Center Interactive Instructions Info */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 flex flex-col justify-start gap-8 z-10 pointer-events-auto">
        <div className="text-center space-y-3">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-mono tracking-wide uppercase ${
              isDark
                ? "bg-zinc-900/60 border-zinc-800 text-zinc-400 shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
                : "bg-zinc-100/60 border-zinc-200 text-zinc-600 shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
            }`}
          >
            Decoupled Pipeline Visualization
          </div>
          <div
            className={`text-sm flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 ${
              isDark ? "text-zinc-400" : "text-zinc-500"
            }`}
          >
            <span>🔥 Non-interactive cozy fireplace simulation</span>
            <span className="hidden sm:inline opacity-30">•</span>
            <span>🎹 Trigger Nudge in Leva to run elastic scroll sequence</span>
          </div>
        </div>

        {/* 3-Canvas Stack Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full mt-2">
          {/* 1. Dither Pass */}
          <div
            className={`flex flex-col rounded-2xl border overflow-hidden backdrop-blur-md transition-all duration-300 ${
              isDark
                ? "bg-zinc-900/20 border-zinc-800 hover:border-zinc-700 shadow-[0_8px_30px_rgb(0,0,0,0.3)]"
                : "bg-zinc-50/20 border-zinc-200 hover:border-zinc-300 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
            }`}
          >
            <div
              className={`px-5 py-4 border-b flex flex-col gap-1 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono tracking-wider uppercase opacity-50">
                  Pass 01
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[9px] font-mono ${
                    isDark
                      ? "bg-zinc-800 text-zinc-300"
                      : "bg-zinc-100 text-zinc-700"
                  }`}
                >
                  Dither Pass
                </span>
              </div>
              <h2 className="text-sm font-bold tracking-tight">
                01. Bayer Dither
              </h2>
              <p
                className={`text-xs leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
              >
                Bayer 8x8 matrix dithering a static vertical gradient.
              </p>
            </div>
            <div className="h-70 w-full relative bg-transparent overflow-hidden">
              <Dither
                mode="dither"
                fireSpeed={animatedFireSpeed}
                noiseScale={[values.noiseScaleX, values.noiseScaleY]}
                flameHeight={animatedFlameHeight}
                noiseStrength={animatedNoiseStrength}
                burnProgress={animatedProgress}
                fireRange={values.fireRange}
                colorNum={values.colorNum}
                pixelSize={values.pixelSize}
                ditherOpacity={isDark ? [1.0, 1.0] : [0.42, 0.94]}
                waveColor={waveColor}
                flameColors={isDark ? blueFlameColors : orangeFlameColors}
                flameBodyHeat={isDark ? 0.5 : 0.7}
                flameHeatPower={isDark ? 1.0 : 1.18}
                flamePositionBias={isDark ? 0.15 : 0.2}
              />
            </div>
          </div>

          {/* 2. Fire Pass */}
          <div
            className={`flex flex-col rounded-2xl border overflow-hidden backdrop-blur-md transition-all duration-300 ${
              isDark
                ? "bg-zinc-900/20 border-zinc-800 hover:border-zinc-700 shadow-[0_8px_30px_rgb(0,0,0,0.3)]"
                : "bg-zinc-50/20 border-zinc-200 hover:border-zinc-300 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
            }`}
          >
            <div
              className={`px-5 py-4 border-b flex flex-col gap-1 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono tracking-wider uppercase opacity-50">
                  Pass 02
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[9px] font-mono ${
                    isDark
                      ? "bg-zinc-800 text-zinc-300"
                      : "bg-zinc-100 text-zinc-700"
                  }`}
                >
                  Fire Simulation
                </span>
              </div>
              <h2 className="text-sm font-bold tracking-tight">
                02. FBM Noise Fire
              </h2>
              <p
                className={`text-xs leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
              >
                Smooth Perlin FBM fireplace simulation with physics trail.
              </p>
            </div>
            <div className="h-70 w-full relative bg-transparent overflow-hidden">
              <Dither
                mode="fire"
                fireSpeed={animatedFireSpeed}
                noiseScale={[values.noiseScaleX, values.noiseScaleY]}
                flameHeight={animatedFlameHeight}
                noiseStrength={animatedNoiseStrength}
                burnProgress={animatedProgress}
                fireRange={values.fireRange}
                colorNum={values.colorNum}
                pixelSize={values.pixelSize}
                ditherOpacity={isDark ? [1.0, 1.0] : [0.42, 0.94]}
                waveColor={waveColor}
                flameColors={isDark ? blueFlameColors : orangeFlameColors}
                flameBodyHeat={isDark ? 0.5 : 0.7}
                flameHeatPower={isDark ? 1.0 : 1.18}
                flamePositionBias={isDark ? 0.15 : 0.2}
              />
            </div>
          </div>

          {/* 3. Combined Result */}
          <div
            className={`flex flex-col rounded-2xl border overflow-hidden backdrop-blur-md transition-all duration-300 ${
              isDark
                ? "bg-zinc-900/20 border-zinc-800 hover:border-zinc-700 shadow-[0_8px_30px_rgb(0,0,0,0.3)]"
                : "bg-zinc-50/20 border-zinc-200 hover:border-zinc-300 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
            }`}
          >
            <div
              className={`px-5 py-4 border-b flex flex-col gap-1 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono tracking-wider uppercase opacity-50">
                  Pass 03
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[9px] font-mono ${
                    isDark
                      ? "bg-zinc-800 text-zinc-300"
                      : "bg-zinc-100 text-zinc-700"
                  }`}
                >
                  Final Output
                </span>
              </div>
              <h2 className="text-sm font-bold tracking-tight">
                03. Combined Result
              </h2>
              <p
                className={`text-xs leading-relaxed ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
              >
                The pixelated fireplace dither shader combining both passes.
              </p>
            </div>
            <div className="h-70 w-full relative bg-transparent overflow-hidden">
              <Dither
                mode="combined"
                fireSpeed={animatedFireSpeed}
                noiseScale={[values.noiseScaleX, values.noiseScaleY]}
                flameHeight={animatedFlameHeight}
                noiseStrength={animatedNoiseStrength}
                burnProgress={animatedProgress}
                fireRange={values.fireRange}
                colorNum={values.colorNum}
                pixelSize={values.pixelSize}
                ditherOpacity={isDark ? [1.0, 1.0] : [0.42, 0.94]}
                waveColor={waveColor}
                flameColors={isDark ? blueFlameColors : orangeFlameColors}
                flameBodyHeat={isDark ? 0.5 : 0.7}
                flameHeatPower={isDark ? 1.0 : 1.18}
                flamePositionBias={isDark ? 0.15 : 0.2}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
