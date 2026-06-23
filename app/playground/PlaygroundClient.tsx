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
  const [isAnimating, setIsAnimating] = useState(false);

  // Leva controls for shader parameters
  const [values, set] = useControls(() => ({
    fireSpeed: {
      value: 0.55,
      min: 0.0,
      max: 2.0,
      step: 0.05,
      label: "Fire Speed",
    },
    noiseScaleX: {
      value: 3.5,
      min: 0.5,
      max: 10.0,
      step: 0.1,
      label: "Noise Scale X",
    },
    noiseScaleY: {
      value: 2.8,
      min: 0.5,
      max: 10.0,
      step: 0.1,
      label: "Noise Scale Y",
    },
    flameHeight: {
      value: 0.85,
      min: 0.1,
      max: 1.2,
      step: 0.05,
      label: "Flame Height",
    },
    noiseStrength: {
      value: 0.42,
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
    windStrength: {
      value: 0.55,
      min: 0.0,
      max: 2.0,
      step: 0.05,
      label: "Wind Strength",
    },
    blowRadius: {
      value: 0.5,
      min: 0.1,
      max: 1.5,
      step: 0.05,
      label: "Blow Radius",
    },
    blowForce: {
      value: 0.65,
      min: 0.0,
      max: 2.0,
      step: 0.05,
      label: "Blow Force",
    },
    colorNum: { value: 2, min: 2, max: 8, step: 1, label: "Dither Colors" },
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
      set({ burnProgress: 0.0 });
      setAnimatedProgress(0.0);
    }),
  }));

  // Handle burnProgress height animation when Trigger is clicked
  useEffect(() => {
    if (!isAnimating) return;

    let frameId: number;
    let current = 0.0;

    const animate = () => {
      current += 0.022; // ~45 frames to reach stable fireplace flame
      if (current > 1.0) {
        current = 1.0;
        setIsAnimating(false);
        set({ burnProgress: 1.0 });
        setAnimatedProgress(1.0);
      } else {
        set({ burnProgress: Number(current.toFixed(3)) });
        setAnimatedProgress(current);
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [isAnimating, set]);

  // Synchronize manual slider change with local animated progress state when not animating
  useEffect(() => {
    if (!isAnimating) {
      setAnimatedProgress(values.burnProgress);
    }
  }, [values.burnProgress, isAnimating]);

  const isDark = values.themeOverride === "dark";
  const waveColor: [number, number, number] = isDark
    ? [0.985, 0.985, 0.985] // zinc-50
    : [0.047, 0.047, 0.047]; // zinc-900

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
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 pointer-events-none">
        <div className="max-w-md space-y-4">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono ${
              isDark
                ? "bg-zinc-900/60 border-zinc-800 text-zinc-400"
                : "bg-zinc-100/60 border-zinc-200 text-zinc-600"
            }`}
          >
            Interactive Features Active
          </div>
          <div
            className={`text-sm space-y-1 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
          >
            <p>👋 Move cursor over bottom area to create wind gusts</p>
            <p>💥 Click/tap inside bottom area to blow & disperse fire</p>
            <p>
              🎹 Trigger Nudge in Leva to preview elastic activation sequence
            </p>
          </div>
        </div>
      </main>

      {/* Bottom Shader preview zone */}
      <div
        className={`w-full h-[180px] relative overflow-hidden border-t pointer-events-auto ${
          isDark
            ? "border-zinc-900 bg-zinc-950/20"
            : "border-zinc-100 bg-zinc-50/20"
        }`}
      >
        <Dither
          fireSpeed={values.fireSpeed}
          noiseScale={[values.noiseScaleX, values.noiseScaleY]}
          flameHeight={values.flameHeight}
          noiseStrength={values.noiseStrength}
          burnProgress={animatedProgress}
          windStrength={values.windStrength}
          blowRadius={values.blowRadius}
          blowForce={values.blowForce}
          colorNum={values.colorNum}
          pixelSize={values.pixelSize}
          waveColor={waveColor}
        />
      </div>
    </div>
  );
}
