"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Dither = dynamic(() => import("./ui/shaders/dither"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-transparent" />,
});

export default function BottomShader() {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);

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

  if (isSupported === null || !isSupported) {
    return (
      <div className="absolute left-0 right-0 bottom-0 h-[120px] bg-transparent pointer-events-none z-0" />
    );
  }

  return (
    <div className="absolute left-0 right-0 bottom-0 h-[120px] overflow-hidden pointer-events-none z-0">
      <Dither
        waveSpeed={0.15}
        waveFrequency={2.5}
        waveAmplitude={0.3}
        waveColor={[0.55, 0.5, 0.65]}
        colorNum={4}
        pixelSize={3}
        enableMouseInteraction={false}
      />
    </div>
  );
}
